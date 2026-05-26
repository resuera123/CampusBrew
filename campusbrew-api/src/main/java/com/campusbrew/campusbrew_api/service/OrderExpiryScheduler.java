package com.campusbrew.campusbrew_api.service;

import com.campusbrew.campusbrew_api.model.Order;
import com.campusbrew.campusbrew_api.model.OrderStatus;
import com.campusbrew.campusbrew_api.model.PaymentStatus;
import com.campusbrew.campusbrew_api.model.Shop;
import com.campusbrew.campusbrew_api.model.StatusHistoryEntry;
import com.campusbrew.campusbrew_api.repository.OrderRepository;
import com.campusbrew.campusbrew_api.repository.ShopRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Marketplace safety net. If no DP claims a READY_FOR_PICKUP order within
 * {@code delivery.orderExpiry.minutes}, this scheduler cancels it (soft cancel —
 * status flips to CANCELLED, GCash flips to REFUND_PENDING). Runs every minute.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class OrderExpiryScheduler {

    private final OrderRepository orderRepository;
    private final ShopRepository shopRepository;
    private final SocketService socketService;

    @Value("${delivery.orderExpiry.minutes:10}")
    private long expiryMinutes;

    /** Runs every 60s. fixedRate is fine — overlapping runs would no-op anyway. */
    @Scheduled(fixedRate = 60_000L)
    public void cancelStaleReadyOrders() {
        Date cutoff = new Date(System.currentTimeMillis() - expiryMinutes * 60_000L);
        List<Order> stale = orderRepository
                .findByOrderStatusAndDeliveryPersonnelIdIsNullAndReadyAtLessThan(
                        OrderStatus.READY_FOR_PICKUP, cutoff);
        if (stale.isEmpty()) return;

        log.info("Auto-cancelling {} unclaimed order(s) past the {}-min expiry", stale.size(), expiryMinutes);
        Date now = Date.from(Instant.now());

        for (Order order : stale) {
            if (order.getPaymentStatus() == PaymentStatus.PAID_GCASH) {
                order.setPaymentStatus(PaymentStatus.REFUND_PENDING);
            }
            order.setOrderStatus(OrderStatus.CANCELLED);
            order.setUpdatedAt(now);
            if (order.getStatusHistory() == null) order.setStatusHistory(new ArrayList<>());
            order.getStatusHistory().add(StatusHistoryEntry.builder()
                    .status(OrderStatus.CANCELLED).timestamp(now).build());
            orderRepository.save(order);

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("orderId", order.getId());
            payload.put("status", OrderStatus.CANCELLED.name());
            payload.put("paymentStatus", order.getPaymentStatus() == null ? null : order.getPaymentStatus().name());
            payload.put("reason", "expired");
            payload.put("timestamp", now);

            socketService.emitToUser(order.getCustomerId(), "order:statusUpdate", payload);
            socketService.emitToOrder(order.getId(), "order:statusUpdate", payload);
            shopRepository.findById(order.getShopId()).map(Shop::getOperatorId)
                    .ifPresent(opId -> socketService.emitToUser(opId, "order:statusUpdate", payload));
        }
    }
}
