package com.campusbrew.campusbrew_api.service;

import com.campusbrew.campusbrew_api.dto.OrderDTO;
import com.campusbrew.campusbrew_api.model.DeliveryPersonnel;
import com.campusbrew.campusbrew_api.model.Order;
import com.campusbrew.campusbrew_api.model.OrderStatus;
import com.campusbrew.campusbrew_api.model.PaymentMethod;
import com.campusbrew.campusbrew_api.model.PaymentStatus;
import com.campusbrew.campusbrew_api.model.Shop;
import com.campusbrew.campusbrew_api.model.StatusHistoryEntry;
import com.campusbrew.campusbrew_api.model.Transaction;
import com.campusbrew.campusbrew_api.model.TransactionStatus;
import com.campusbrew.campusbrew_api.repository.DeliveryPersonnelRepository;
import com.campusbrew.campusbrew_api.repository.OrderRepository;
import com.campusbrew.campusbrew_api.repository.ShopRepository;
import com.campusbrew.campusbrew_api.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Module 3 §3.3 — order lifecycle after delivery assignment.
 * ASSIGNED → OUT_FOR_DELIVERY → DELIVERED. Writes a {@link Transaction} on
 * confirmation; Module 4 extends commission/incentive math by adding to that
 * record's pipeline (not by re-implementing this service).
 */
@Service
@RequiredArgsConstructor
public class DeliveryFulfillmentService {

    private final OrderRepository orderRepository;
    private final DeliveryPersonnelRepository deliveryPersonnelRepository;
    private final ShopRepository shopRepository;
    private final TransactionRepository transactionRepository;
    private final SocketService socketService;

    public OrderDTO markPickedUp(String dpUserId, String orderId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new RuntimeException("Order not found"));
        requireAssignedTo(order, dpUserId);
        if (order.getOrderStatus() != OrderStatus.ASSIGNED) {
            throw new RuntimeException("Order is in status " + order.getOrderStatus()
                    + ", expected ASSIGNED");
        }

        applyTransition(order, OrderStatus.OUT_FOR_DELIVERY);
        Order saved = orderRepository.save(order);

        Map<String, Object> payload = statusPayload(saved);
        socketService.emitToUser(saved.getCustomerId(), "order:outForDelivery", payload);
        socketService.emitToOrder(saved.getId(), "order:statusUpdate", payload);

        return toDTO(saved);
    }

    public OrderDTO confirmDelivery(String dpUserId, String orderId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new RuntimeException("Order not found"));
        requireAssignedTo(order, dpUserId);
        if (order.getOrderStatus() != OrderStatus.OUT_FOR_DELIVERY) {
            throw new RuntimeException("Order is in status " + order.getOrderStatus()
                    + ", expected OUT_FOR_DELIVERY");
        }

        // Flip COD payment status — the DP has confirmed cash in hand.
        if (order.getPaymentMethod() == PaymentMethod.COD
                && order.getPaymentStatus() == PaymentStatus.PENDING_COD) {
            order.setPaymentStatus(PaymentStatus.PAID_COD);
        }

        applyTransition(order, OrderStatus.DELIVERED);
        Order saved = orderRepository.save(order);

        // Log transaction (Module 4 extends fields like incentive bonuses).
        Transaction tx = Transaction.builder()
                .orderId(saved.getId())
                .customerId(saved.getCustomerId())
                .deliveryPersonnelId(dpUserId)
                .shopId(saved.getShopId())
                .beverageCost(saved.getBeverageSubtotal())
                .deliveryFee(saved.getDeliveryFee())
                .platformCommission(saved.getPlatformCommission())
                .dpEarnings(saved.getDeliveryFee() - saved.getPlatformCommission())
                .paymentMethod(saved.getPaymentMethod())
                .status(TransactionStatus.COMPLETED)
                .createdAt(Date.from(Instant.now()))
                .build();
        transactionRepository.save(tx);

        // Free up the DP and bump their lifetime counter (Module 4 hooks incentives here).
        deliveryPersonnelRepository.findByUserId(dpUserId).ifPresent(dp -> {
            dp.setCurrentOrderId(null);
            dp.setTotalDeliveries(dp.getTotalDeliveries() + 1);
            dp.setUpdatedAt(Date.from(Instant.now()));
            deliveryPersonnelRepository.save(dp);
        });

        Map<String, Object> payload = statusPayload(saved);
        socketService.emitToUser(saved.getCustomerId(), "order:delivered", payload);
        socketService.emitToOrder(saved.getId(), "order:statusUpdate", payload);
        shopRepository.findById(saved.getShopId()).ifPresent(s ->
                socketService.emitToUser(s.getOperatorId(), "order:delivered", payload));

        return toDTO(saved);
    }

    public OrderDTO getCurrentOrder(String dpUserId) {
        DeliveryPersonnel dp = deliveryPersonnelRepository.findByUserId(dpUserId)
                .orElseThrow(() -> new RuntimeException("Delivery profile not found"));
        if (dp.getCurrentOrderId() == null) {
            throw new RuntimeException("No active delivery");
        }
        Order order = orderRepository.findById(dp.getCurrentOrderId())
                .orElseThrow(() -> new RuntimeException("Active order missing"));
        return toDTO(order);
    }

    // ─── helpers ─────────────────────────────────────────────────────────

    private void requireAssignedTo(Order order, String dpUserId) {
        if (!dpUserId.equals(order.getDeliveryPersonnelId())) {
            throw new RuntimeException("This order is not assigned to you");
        }
    }

    private void applyTransition(Order order, OrderStatus next) {
        Date now = Date.from(Instant.now());
        order.setOrderStatus(next);
        order.setUpdatedAt(now);
        if (order.getStatusHistory() == null) {
            order.setStatusHistory(new ArrayList<>());
        }
        order.getStatusHistory().add(
                StatusHistoryEntry.builder().status(next).timestamp(now).build());
    }

    private Map<String, Object> statusPayload(Order order) {
        Map<String, Object> p = new LinkedHashMap<>();
        p.put("orderId", order.getId());
        p.put("status", order.getOrderStatus().name());
        p.put("paymentStatus", order.getPaymentStatus() == null ? null : order.getPaymentStatus().name());
        return p;
    }

    private OrderDTO toDTO(Order order) {
        Shop shop = shopRepository.findById(order.getShopId()).orElse(null);
        return OrderDTO.fromOrder(order, shop != null ? shop.getShopName() : null, null);
    }
}
