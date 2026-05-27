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

@Service
@RequiredArgsConstructor
public class OrderService {

    /**
     * Total delivery charge paid by the customer. The platform keeps
     * {@link #PLATFORM_COMMISSION} from this fee and the dasher gets the rest
     * (or the full fee if their incentive is unlocked).
     */
    private static final double DELIVERY_FEE = 15.0;
    private static final double PLATFORM_COMMISSION = 5.0;

    private final OrderRepository orderRepository;
    private final ShopRepository shopRepository;
    private final UserRepository userRepository;
    private final ShopService shopService;
    private final PaymentService paymentService;
    private final DeliveryAssignmentEngine deliveryAssignmentEngine;
    private final SocketService socketService;

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

        List<OrderItem> orderItems = new ArrayList<>();
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

            orderItems.add(OrderItem.builder()
                    .menuItemId(menuItem.getId())
                    .itemName(menuItem.getName())
                    .quantity(line.getQuantity())
                    .size(line.getSize())
                    .sugarLevel(line.getSugarLevel())
                    .temperature(line.getTemperature())
                    .addOns(line.getAddOns() == null ? List.of() : line.getAddOns())
                    .unitPrice(unitPrice)
                    .totalPrice(totalPrice)
                    .build());
        }

        // PLATFORM_COMMISSION is the platform's cut from DELIVERY_FEE, not a separate charge.
        double total = subtotal + DELIVERY_FEE;
        Date now = Date.from(Instant.now());

        Order order = Order.builder()
                .customerId(userId)
                .shopId(shop.getId())
                .items(orderItems)
                .deliveryLocation(dto.getDeliveryLocation())
                .dasherInstructions(dto.getDasherInstructions())
                .paymentMethod(dto.getPaymentMethod())
                .paymentStatus(PaymentStatus.PENDING)
                .orderStatus(OrderStatus.PLACED)
                .beverageSubtotal(round(subtotal))
                .deliveryFee(DELIVERY_FEE)
                .platformCommission(PLATFORM_COMMISSION)
                .totalAmount(round(total))
                .statusHistory(new ArrayList<>(List.of(
                        StatusHistoryEntry.builder().status(OrderStatus.PLACED).timestamp(now).build()
                )))
                .createdAt(now)
                .updatedAt(now)
                .build();

        PaymentService.PaymentInitResult payment = paymentService.initiate(order);
        order.setPaymentStatus(payment.getStatus());

        Order saved = orderRepository.save(order);
        // Broadcast so the shop queue and any tracking screen pick up the new order live.
        broadcastStatusUpdate(saved, OrderStatus.PLACED, saved.getCreatedAt());
        return OrderDTO.fromOrder(saved, shop.getShopName(), payment.getPaymentUrl());
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
