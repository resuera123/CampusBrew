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

    private static final double DELIVERY_FEE = 10.0;
    private static final double PLATFORM_COMMISSION = 5.0;

    private final OrderRepository orderRepository;
    private final ShopRepository shopRepository;
    private final UserRepository userRepository;
    private final ShopService shopService;
    private final PaymentService paymentService;

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

        double total = subtotal + DELIVERY_FEE + PLATFORM_COMMISSION;
        Date now = Date.from(Instant.now());

        Order order = Order.builder()
                .customerId(userId)
                .shopId(shop.getId())
                .items(orderItems)
                .deliveryLocation(dto.getDeliveryLocation())
                .paymentMethod(dto.getPaymentMethod())
                .paymentStatus(PaymentStatus.PENDING)
                .orderStatus(OrderStatus.PLACED)
                .beverageSubtotal(round(subtotal))
                .deliveryFee(DELIVERY_FEE)
                .platformCommission(PLATFORM_COMMISSION)
                .totalAmount(round(total))
                .createdAt(now)
                .updatedAt(now)
                .build();

        PaymentService.PaymentInitResult payment = paymentService.initiate(order);
        order.setPaymentStatus(payment.getStatus());

        Order saved = orderRepository.save(order);
        return OrderDTO.fromOrder(saved, shop.getShopName(), payment.getPaymentUrl());
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
