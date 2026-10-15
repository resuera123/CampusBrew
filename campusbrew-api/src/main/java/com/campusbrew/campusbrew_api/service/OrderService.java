package com.campusbrew.campusbrew_api.service;

import com.campusbrew.campusbrew_api.dto.*;
import com.campusbrew.campusbrew_api.model.*;
import com.campusbrew.campusbrew_api.repository.OrderRepository;
import com.campusbrew.campusbrew_api.repository.ShopRepository;
import com.campusbrew.campusbrew_api.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class OrderService {

    private final OrderRepository orderRepository;
    private final ShopRepository shopRepository;
    private final UserRepository userRepository;
    private final ShopService shopService;
    private final PaymentService paymentService;
    private final DeliveryAssignmentEngine deliveryAssignmentEngine;
    private final SocketService socketService;
    // v2.0 — fees, COD limit and tip cap come from ConfigService (no hard-coded numbers).
    private final ConfigService configService;

    public OrderDTO createOrder(String userId, CreateOrderDTO dto) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (dto.getItems() == null || dto.getItems().isEmpty()) {
            throw new RuntimeException("Cart is empty");
        }
        if (dto.getShopId() == null || dto.getShopId().isBlank()) {
            throw new RuntimeException("Shop is required");
        }
        if (dto.getDeliveryLocation() == null || dto.getDeliveryLocation().isBlank()) {
            throw new RuntimeException("Delivery location is required");
        }
        if (dto.getPaymentMethod() == null) {
            throw new RuntimeException("Payment method is required");
        }

        Shop shop = shopRepository.findById(dto.getShopId())
                .orElseThrow(() -> new RuntimeException("Shop not found"));

        if (dto.getPaymentMethod() == PaymentMethod.COD
                && user.getVerificationStatus() != VerificationStatus.VERIFIED) {
            throw new RuntimeException("Cash on Delivery requires a verified CIT-U account");
        }

        // v2.0 FR-2.2 — merge identical lines server-side (defensive: the client merges
        // too, but the server recomputes the hash and never trusts the supplied one).
        LinkedHashMap<String, OrderItem> merged = new LinkedHashMap<>();
        double subtotal = 0.0;

        for (CreateOrderItemDTO line : dto.getItems()) {
            MenuItem menuItem = shopService.requireMenuItem(line.getMenuItemId());

            if (!shop.getId().equals(menuItem.getShopId())) {
                throw new RuntimeException("Item " + menuItem.getName() + " does not belong to shop " + shop.getShopName());
            }
            if (!menuItem.isAvailable()) {
                throw new RuntimeException("Item not available: " + menuItem.getName());
            }
            if (line.getQuantity() <= 0) {
                throw new RuntimeException("Invalid quantity for " + menuItem.getName());
            }

            double unitPrice = computeUnitPrice(menuItem, line.getSize(), line.getAddOns());
            double totalPrice = unitPrice * line.getQuantity();
            subtotal += totalPrice;

            String hash = optionsHash(menuItem.getId(), line.getSize(),
                    line.getSugarLevel(), line.getTemperature(), line.getAddOns());

            OrderItem existing = merged.get(hash);
            if (existing != null) {
                existing.setQuantity(existing.getQuantity() + line.getQuantity());
                existing.setTotalPrice(round(existing.getTotalPrice() + totalPrice));
            } else {
                merged.put(hash, OrderItem.builder()
                        .menuItemId(menuItem.getId())
                        .itemName(menuItem.getName())
                        .quantity(line.getQuantity())
                        .size(line.getSize())
                        .sugarLevel(line.getSugarLevel())
                        .temperature(line.getTemperature())
                        .addOns(line.getAddOns() == null ? List.of() : line.getAddOns())
                        .unitPrice(unitPrice)
                        .totalPrice(totalPrice)
                        .optionsHash(hash)
                        .build());
            }
        }

        List<OrderItem> orderItems = new ArrayList<>(merged.values());

        // v2.0 FR-2.2/4.3 — fees from config; commission is the platform's cut from the
        // delivery fee, not a separate charge. Customer pays beverages + fee + tip.
        double deliveryFee = configService.getDeliveryFee();
        double commission = configService.getCommission();

        // v2.0 FR-4.7 — optional tip (0..tip.maxAmount), added to the total, 100% to the dasher.
        double tip = dto.getTip() == null ? 0.0 : dto.getTip();
        if (tip < 0 || tip > configService.getTipMaxAmount()) {
            throw new RuntimeException("Tip must be between ₱0 and ₱"
                    + (int) configService.getTipMaxAmount());
        }

        double total = subtotal + deliveryFee + tip;

        // v2.0 FR-2.2 — COD ceiling re-checked server-side (UI also gates this).
        if (dto.getPaymentMethod() == PaymentMethod.COD && total > configService.getCodLimit()) {
            throw new RuntimeException("Cash on Delivery is only available for orders up to ₱"
                    + (int) configService.getCodLimit() + ". Please pay with GCash.");
        }

        Date now = Date.from(Instant.now());

        Order order = Order.builder()
                .customerId(userId)
                .shopId(shop.getId())
                .items(orderItems)
                .deliveryLocation(dto.getDeliveryLocation())
                .dasherInstructions(dto.getDasherInstructions())
                .dropoffNote(dto.getDropoffNote())
                .paymentMethod(dto.getPaymentMethod())
                .paymentStatus(PaymentStatus.PENDING)
                .orderStatus(OrderStatus.PLACED)
                .beverageSubtotal(round(subtotal))
                .deliveryFee(deliveryFee)
                .platformCommission(commission)
                .tip(tip)
                .totalAmount(round(total))
                .statusHistory(new ArrayList<>(List.of(
                        StatusHistoryEntry.builder().status(OrderStatus.PLACED).timestamp(now).build()
                )))
                .createdAt(now)
                .updatedAt(now)
                .build();

        // v2.0 FR-4.1 — GCash is payment-first: no order is persisted here. The order
        // is created by the webhook once Xendit confirms PAID (see createPaidOrderFromDraft).
        if (order.getPaymentMethod() == PaymentMethod.GCASH) {
            order.setPaymentStatus(PaymentStatus.PENDING);
            return paymentService.initiateGcashCheckout(order, userId, shop.getShopName());
        }

        PaymentService.PaymentInitResult payment = paymentService.initiate(order);
        order.setPaymentStatus(payment.getStatus());

        Order saved = orderRepository.save(order);
        // Broadcast so the shop queue and any tracking screen pick up the new order live.
        broadcastStatusUpdate(saved, OrderStatus.PLACED, saved.getCreatedAt());
        return OrderDTO.fromOrder(saved, shop.getShopName(), payment.getPaymentUrl());
    }

    /**
     * v2.0 FR-4.1 — materialize the order carried by a now-PAID GCash payment. Called by
     * the webhook controller. Idempotent: if the payment already produced an order, that
     * order is returned instead of creating a second one.
     */
    public OrderDTO createPaidOrderFromDraft(com.campusbrew.campusbrew_api.model.Payment payment) {
        if (payment.getOrderId() != null) {
            Order existing = orderRepository.findById(payment.getOrderId()).orElse(null);
            if (existing != null) {
                String name = shopRepository.findById(existing.getShopId())
                        .map(Shop::getShopName).orElse(null);
                return OrderDTO.fromOrder(existing, name, null);
            }
        }

        Order draft = payment.getOrderDraft();
        if (draft == null) {
            throw new RuntimeException("Payment " + payment.getId() + " has no order draft");
        }

        Date now = Date.from(Instant.now());
        draft.setId(null);
        draft.setPaymentStatus(PaymentStatus.PAID_GCASH);
        draft.setOrderStatus(OrderStatus.PLACED);
        draft.setStatusHistory(new ArrayList<>(List.of(
                StatusHistoryEntry.builder().status(OrderStatus.PLACED).timestamp(now).build())));
        draft.setCreatedAt(now);
        draft.setUpdatedAt(now);

        Order saved = orderRepository.save(draft);
        paymentService.attachOrder(payment.getId(), saved.getId());

        // Broadcast so the shop queue and any tracking screen pick up the new order live.
        broadcastStatusUpdate(saved, OrderStatus.PLACED, saved.getCreatedAt());
        String shopName = shopRepository.findById(saved.getShopId())
                .map(Shop::getShopName).orElse(null);
        return OrderDTO.fromOrder(saved, shopName, null);
    }

    /**
     * Single-order fetch for the tracking screen. Authorized for the customer who placed
     * it, the assigned delivery personnel, or the shop operator who owns the shop.
     */
    public OrderDTO getOrderForUser(String userId, String orderId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new RuntimeException("Order not found"));

        boolean isCustomer = userId.equals(order.getCustomerId());
        boolean isAssignedDp = userId.equals(order.getDeliveryPersonnelId());
        boolean isShopOperator = shopRepository.findById(order.getShopId())
                .map(s -> userId.equals(s.getOperatorId()))
                .orElse(false);

        if (!isCustomer && !isAssignedDp && !isShopOperator) {
            throw new RuntimeException("Not authorized to view this order");
        }

        Shop shop = shopRepository.findById(order.getShopId()).orElse(null);
        String shopName = shop != null ? shop.getShopName() : null;
        String customerName = userRepository.findById(order.getCustomerId())
                .map(User::getFullName).orElse(null);
        String dpName = order.getDeliveryPersonnelId() == null ? null
                : userRepository.findById(order.getDeliveryPersonnelId())
                        .map(User::getFullName).orElse(null);
        return OrderDTO.fromOrder(order, shopName, null, customerName, dpName);
    }

    public Page<OrderDTO> getOrderHistory(String userId, int page) {
        Pageable pageable = PageRequest.of(Math.max(page, 0), 10, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<Order> orders = orderRepository.findByCustomerIdOrderByCreatedAtDesc(userId, pageable);

        Map<String, String> shopNames = resolveShopNames(orders.getContent());
        return orders.map(o -> OrderDTO.fromOrder(o, shopNames.get(o.getShopId()), null));
    }

    public ReorderDTO prepareReorder(String userId, String orderId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new RuntimeException("Order not found"));

        if (!order.getCustomerId().equals(userId)) {
            throw new RuntimeException("Not authorized to reorder this order");
        }

        Shop shop = shopRepository.findById(order.getShopId())
                .orElseThrow(() -> new RuntimeException("Shop no longer exists"));

        List<ReorderItemDTO> items = new ArrayList<>();
        List<String> unavailable = new ArrayList<>();
        List<PriceChangeNote> priceChanges = new ArrayList<>();

        for (OrderItem past : order.getItems()) {
            Optional<MenuItem> currentOpt = Optional.empty();
            try {
                currentOpt = Optional.of(shopService.requireMenuItem(past.getMenuItemId()));
            } catch (RuntimeException ignored) {
                // item deleted from menu
            }

            if (currentOpt.isEmpty() || !currentOpt.get().isAvailable()) {
                unavailable.add(past.getItemName());
                continue;
            }

            MenuItem current = currentOpt.get();
            double newUnit = computeUnitPrice(current, past.getSize(), past.getAddOns());
            if (Math.abs(newUnit - past.getUnitPrice()) > 0.001) {
                priceChanges.add(new PriceChangeNote(current.getName(), past.getUnitPrice(), newUnit));
            }

            items.add(ReorderItemDTO.builder()
                    .menuItemId(current.getId())
                    .itemName(current.getName())
                    .image(current.getImage())
                    .quantity(past.getQuantity())
                    .size(past.getSize())
                    .sugarLevel(past.getSugarLevel())
                    .temperature(past.getTemperature())
                    .addOns(past.getAddOns())
                    .currentUnitPrice(newUnit)
                    .currentTotalPrice(round(newUnit * past.getQuantity()))
                    .isAvailable(true)
                    .build());
        }

        return ReorderDTO.builder()
                .shopId(shop.getId())
                .shopName(shop.getShopName())
                .items(items)
                .unavailableItems(unavailable)
                .priceChanges(priceChanges)
                .build();
    }

    /**
     * Public marketplace list for delivery personnel: every order in READY_FOR_PICKUP
     * with no assigned DP, sorted by readyAt ASC (oldest first, closest to the 10-min
     * expiry deadline so they're picked up before being cancelled).
     */
    /** Dasher's own history: every DELIVERED order they delivered, newest first. */
    public List<OrderDTO> getDeliveryHistory(String dpUserId) {
        User dp = userRepository.findById(dpUserId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        if (dp.getRole() != UserRole.DELIVERY_PERSONNEL) {
            throw new RuntimeException("Only delivery personnel can browse delivery history");
        }
        List<Order> orders = orderRepository
                .findByDeliveryPersonnelIdAndOrderStatusOrderByUpdatedAtDesc(dpUserId, OrderStatus.DELIVERED);
        Map<String, String> shopNames = resolveShopNames(orders);
        return orders.stream()
                .map(o -> OrderDTO.fromOrder(o, shopNames.get(o.getShopId()), null))
                .collect(java.util.stream.Collectors.toList());
    }

    public List<OrderDTO> getAvailableDeliveries(String dpUserId) {
        User dp = userRepository.findById(dpUserId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        if (dp.getRole() != UserRole.DELIVERY_PERSONNEL) {
            throw new RuntimeException("Only delivery personnel can browse available orders");
        }
        List<Order> orders = orderRepository
                .findByOrderStatusAndDeliveryPersonnelIdIsNullOrderByReadyAtAsc(OrderStatus.READY_FOR_PICKUP);
        Map<String, String> shopNames = resolveShopNames(orders);
        return orders.stream()
                .map(o -> OrderDTO.fromOrder(o, shopNames.get(o.getShopId()), null))
                .collect(java.util.stream.Collectors.toList());
    }

    public List<OrderDTO> getShopOrders(String operatorUserId, String shopId, Collection<OrderStatus> statuses) {
        Shop shop = requireOwnedShop(operatorUserId, shopId);
        List<Order> orders = (statuses == null || statuses.isEmpty())
                ? orderRepository.findByShopIdOrderByCreatedAtDesc(shopId)
                : orderRepository.findByShopIdAndOrderStatusInOrderByCreatedAtDesc(shopId, statuses);

        // Batch-resolve names for both parties in one DB hit each.
        Set<String> userIds = new HashSet<>();
        for (Order o : orders) {
            userIds.add(o.getCustomerId());
            if (o.getDeliveryPersonnelId() != null) userIds.add(o.getDeliveryPersonnelId());
        }
        Map<String, String> names = new HashMap<>();
        userRepository.findAllById(userIds).forEach(u -> names.put(u.getId(), u.getFullName()));

        return orders.stream()
                .map(o -> OrderDTO.fromOrder(
                        o,
                        shop.getShopName(),
                        null,
                        names.get(o.getCustomerId()),
                        o.getDeliveryPersonnelId() == null ? null : names.get(o.getDeliveryPersonnelId())))
                .collect(java.util.stream.Collectors.toList());
    }

    public OrderDTO acceptOrder(String operatorUserId, String orderId) {
        return transitionShopOrder(operatorUserId, orderId, OrderStatus.PLACED, OrderStatus.PREPARING);
    }

    public OrderDTO markReady(String operatorUserId, String orderId) {
        OrderDTO updated = transitionShopOrder(operatorUserId, orderId, OrderStatus.PREPARING, OrderStatus.READY_FOR_PICKUP);
        // Stamp readyAt so the 10-min auto-cancel scheduler and the shop UI countdown
        // both have a single source of truth.
        orderRepository.findById(orderId).ifPresent(o -> {
            o.setReadyAt(Date.from(Instant.now()));
            orderRepository.save(o);
            // Hybrid model: kick off a 30s proximity offer to the nearest active DP.
            // If they don't claim it within the offer window, the order falls into the
            // public marketplace list (GET /api/delivery/orders/available) and any DP
            // can claim. If still unclaimed after 10 min total, the scheduler cancels it.
            deliveryAssignmentEngine.assignOrder(o);
        });
        return updated;
    }

    /**
     * Shop-initiated cancel. Allowed while the order is still pre-handoff:
     * PLACED (refuse), PREPARING (pull back mid-prep), or READY_FOR_PICKUP (recall
     * before a dasher claims). Once a dasher has the order (ASSIGNED+) the shop
     * can't cancel — that's a delivery-side concern.
     */
    public OrderDTO rejectOrder(String operatorUserId, String orderId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new RuntimeException("Order not found"));
        Shop shop = requireOwnedShop(operatorUserId, order.getShopId());
        OrderStatus s = order.getOrderStatus();
        if (s != OrderStatus.PLACED && s != OrderStatus.PREPARING && s != OrderStatus.READY_FOR_PICKUP) {
            throw new RuntimeException("Cannot cancel an order in status " + s);
        }
        if (order.getPaymentStatus() == PaymentStatus.PAID_GCASH) {
            order.setPaymentStatus(PaymentStatus.REFUND_PENDING);
        }
        Order saved = applyStatusTransition(order, OrderStatus.CANCELLED);
        return OrderDTO.fromOrder(saved, shop.getShopName(), null);
    }

    /**
     * v2.0 FR-3.3 — the shop confirms it received payment from the dasher at pickup.
     * Stamps shopPaymentConfirmedAt and notifies the dasher and customer. Allowed
     * once a dasher is assigned (ASSIGNED, or OUT_FOR_DELIVERY if confirmed late).
     */
    public OrderDTO confirmPaymentReceived(String operatorUserId, String orderId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new RuntimeException("Order not found"));
        Shop shop = requireOwnedShop(operatorUserId, order.getShopId());
        if (order.getOrderStatus() != OrderStatus.ASSIGNED
                && order.getOrderStatus() != OrderStatus.OUT_FOR_DELIVERY) {
            throw new RuntimeException("Payment can only be confirmed after a dasher is assigned");
        }
        Date now = Date.from(Instant.now());
        order.setShopPaymentConfirmedAt(now);
        order.setUpdatedAt(now);
        Order saved = orderRepository.save(order);

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("orderId", saved.getId());
        payload.put("shopPaymentConfirmedAt", now);
        if (saved.getDeliveryPersonnelId() != null) {
            socketService.emitToUser(saved.getDeliveryPersonnelId(), "order:paymentReceived", payload);
        }
        socketService.emitToUser(saved.getCustomerId(), "order:paymentReceived", payload);
        return OrderDTO.fromOrder(saved, shop.getShopName(), null);
    }

    private OrderDTO transitionShopOrder(String operatorUserId, String orderId,
                                         OrderStatus expected, OrderStatus next) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new RuntimeException("Order not found"));
        Shop shop = requireOwnedShop(operatorUserId, order.getShopId());
        if (order.getOrderStatus() != expected) {
            throw new RuntimeException("Order is in status " + order.getOrderStatus()
                    + ", expected " + expected);
        }
        Order saved = applyStatusTransition(order, next);
        return OrderDTO.fromOrder(saved, shop.getShopName(), null);
    }

    /**
     * Mutate, persist, then broadcast — in that order. Broadcasting before the
     * save creates a race where the customer's refetch (triggered by the event)
     * can read stale data. Saving first guarantees the customer's order:statusUpdate
     * subscribers see the new state on refetch.
     */
    private Order applyStatusTransition(Order order, OrderStatus next) {
        Date now = Date.from(Instant.now());
        order.setOrderStatus(next);
        order.setUpdatedAt(now);
        if (order.getStatusHistory() == null) {
            order.setStatusHistory(new ArrayList<>());
        }
        order.getStatusHistory().add(
                StatusHistoryEntry.builder().status(next).timestamp(now).build());
        Order saved = orderRepository.save(order);
        broadcastStatusUpdate(saved, next, now);
        return saved;
    }

    /**
     * Push the new status to everyone interested. Customer + shop operator always; the
     * assigned DP gets it too if attached. Frontend's OrderTrackingScreen listens on
     * the customer's user room.
     */
    private void broadcastStatusUpdate(Order order, OrderStatus next, Date when) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("orderId", order.getId());
        payload.put("status", next.name());
        payload.put("paymentStatus", order.getPaymentStatus() == null ? null : order.getPaymentStatus().name());
        payload.put("timestamp", when);

        socketService.emitToUser(order.getCustomerId(), "order:statusUpdate", payload);
        socketService.emitToOrder(order.getId(), "order:statusUpdate", payload);
        shopRepository.findById(order.getShopId()).ifPresent(s ->
                socketService.emitToUser(s.getOperatorId(), "order:statusUpdate", payload));
        if (order.getDeliveryPersonnelId() != null) {
            socketService.emitToUser(order.getDeliveryPersonnelId(), "order:statusUpdate", payload);
        }
    }

    private Shop requireOwnedShop(String operatorUserId, String shopId) {
        User user = userRepository.findById(operatorUserId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        if (user.getRole() != UserRole.SHOP_OPERATOR) {
            throw new RuntimeException("Only shop operators can manage shop orders");
        }
        Shop shop = shopRepository.findById(shopId)
                .orElseThrow(() -> new RuntimeException("Shop not found"));
        if (!operatorUserId.equals(shop.getOperatorId())) {
            throw new RuntimeException("Shop does not belong to this operator");
        }
        return shop;
    }

    /**
     * v2.0 FR-2.2 — stable identity for a configured line (add-ons order-independent),
     * matching the client's optionsHashOf so both sides merge the same lines.
     */
    private String optionsHash(String menuItemId, String size, String sugarLevel,
                               String temperature, List<String> addOns) {
        String a = (addOns == null ? List.<String>of() : addOns).stream()
                .map(s -> s.trim().toLowerCase())
                .sorted()
                .collect(Collectors.joining("|"));
        return String.join("::",
                menuItemId,
                size == null ? "" : size,
                sugarLevel == null ? "" : sugarLevel,
                temperature == null ? "" : temperature,
                a);
    }

    private double computeUnitPrice(MenuItem item, String size, List<String> addOnNames) {
        double price = item.getPrice();
        CustomizationOptions opts = item.getCustomizationOptions();

        if (opts != null && size != null && opts.getSizes() != null) {
            for (SizeOption so : opts.getSizes()) {
                if (size.equalsIgnoreCase(so.getLabel())) {
                    price += so.getPriceModifier();
                    break;
                }
            }
        }

        if (opts != null && addOnNames != null && opts.getAddOns() != null) {
            for (String addOnName : addOnNames) {
                for (AddOnOption ao : opts.getAddOns()) {
                    if (addOnName.equalsIgnoreCase(ao.getName())) {
                        price += ao.getPrice();
                        break;
                    }
                }
            }
        }

        return round(price);
    }

    private Map<String, String> resolveShopNames(List<Order> orders) {
        Set<String> shopIds = new HashSet<>();
        for (Order o : orders) shopIds.add(o.getShopId());

        Map<String, String> names = new HashMap<>();
        shopRepository.findAllById(shopIds).forEach(s -> names.put(s.getId(), s.getShopName()));
        return names;
    }

    private double round(double value) {
        return Math.round(value * 100.0) / 100.0;
    }
}
