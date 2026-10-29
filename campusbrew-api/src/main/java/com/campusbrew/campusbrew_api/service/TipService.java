package com.campusbrew.campusbrew_api.service;

import com.campusbrew.campusbrew_api.dto.TipStatusDTO;
import com.campusbrew.campusbrew_api.model.Order;
import com.campusbrew.campusbrew_api.model.OrderStatus;
import com.campusbrew.campusbrew_api.model.Payment;
import com.campusbrew.campusbrew_api.model.PaymentRecordStatus;
import com.campusbrew.campusbrew_api.model.PaymentType;
import com.campusbrew.campusbrew_api.model.User;
import com.campusbrew.campusbrew_api.repository.OrderRepository;
import com.campusbrew.campusbrew_api.repository.PaymentRepository;
import com.campusbrew.campusbrew_api.repository.TransactionRepository;
import com.campusbrew.campusbrew_api.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * v2.0 FR-4.7 — tipping the dasher after delivery.
 *
 * Only the order's customer may tip, once, within {@code tip.windowHours} of
 * delivery, up to {@code tip.maxAmount}. The tip is paid by GCash through
 * {@link PaymentService}; nothing is recorded until the webhook reports PAID, when
 * {@link #creditTip} adds 100% of it to the dasher (transaction + earnings) and
 * notifies them. A failed or expired payment leaves no tip, so the customer can retry.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TipService {

    static final List<Integer> PRESETS = List.of(5, 10, 20);
    /** GCash won't charge less than ₱1. */
    static final double MIN_AMOUNT = 1.0;

    private final OrderRepository orderRepository;
    private final PaymentRepository paymentRepository;
    private final TransactionRepository transactionRepository;
    private final UserRepository userRepository;
    private final PaymentService paymentService;
    private final ConfigService configService;
    private final SocketService socketService;
    private final PushNotificationService pushNotificationService;

    public TipStatusDTO status(String userId, String orderId) {
        Order order = requireCustomerOrder(userId, orderId);
        double paidTip = paidPostDeliveryTip(orderId);
        String reason = closedReason(order, paidTip);
        return TipStatusDTO.builder()
                .orderId(orderId)
                .canTip(reason == null)
                .reason(reason)
                .closesAt(closesAt(order))
                .maxAmount(configService.getTipMaxAmount())
                .presets(PRESETS)
                .dasherName(order.getDeliveryPersonnelId() == null ? null
                        : userRepository.findById(order.getDeliveryPersonnelId()).map(User::getFullName).orElse(null))
                .checkoutTip(order.getTip())
                .postDeliveryTip(paidTip)
                .build();
    }

    /** Starts a GCash charge for the tip; returns the payment to poll and the checkout URL. */
    public PaymentService.TipCharge start(String userId, String orderId, double rawAmount) {
        Order order = requireCustomerOrder(userId, orderId);
        String reason = closedReason(order, paidPostDeliveryTip(orderId));
        if (reason != null) {
            throw new IllegalStateException(reason);
        }
        double amount = Math.round(rawAmount * 100) / 100.0;
        double max = configService.getTipMaxAmount();
        if (amount < MIN_AMOUNT || amount > max) {
            throw new IllegalArgumentException(String.format("Tip must be between ₱%.0f and ₱%.0f", MIN_AMOUNT, max));
        }
        return paymentService.initiateTipCharge(userId, orderId, amount);
    }

    /**
     * Called once per tip, when its payment first reaches PAID (the webhook is
     * idempotent on PAID). Credits the dasher in full and lets them know.
     */
    public void creditTip(Payment payment) {
        Order order = orderRepository.findById(payment.getOrderId()).orElse(null);
        if (order == null) {
            log.warn("Paid tip {} references missing order {}", payment.getId(), payment.getOrderId());
            return;
        }
        double amount = payment.getAmount();
        transactionRepository.findByOrderId(order.getId()).ifPresentOrElse(tx -> {
            tx.setPostDeliveryTip(tx.getPostDeliveryTip() + amount);
            tx.setDpEarnings(tx.getDpEarnings() + amount);
            transactionRepository.save(tx);
        }, () -> log.warn("Paid tip {} has no transaction for order {}", payment.getId(), order.getId()));

        String dasherId = order.getDeliveryPersonnelId();
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("orderId", order.getId());
        payload.put("amount", amount);
        socketService.emitToUser(dasherId, "tip:received", payload);

        String customerName = userRepository.findById(order.getCustomerId())
                .map(User::getFullName).orElse("A customer");
        pushNotificationService.send(dasherId, String.format("You got a ₱%.0f tip!", amount),
                customerName + " tipped you for order #" + shortId(order.getId()) + ".",
                Map.of("orderId", order.getId(), "type", "tip"));
    }

    /** Null while the customer can tip; otherwise a short user-facing reason. */
    private String closedReason(Order order, double paidTip) {
        if (order.getOrderStatus() != OrderStatus.DELIVERED) {
            return "You can tip once the order is delivered";
        }
        if (order.getDeliveryPersonnelId() == null) {
            return "There's no dasher to tip on this order";
        }
        if (paidTip > 0) {
            return "You already tipped for this order";
        }
        Date closesAt = closesAt(order);
        if (closesAt == null || !Instant.now().isBefore(closesAt.toInstant())) {
            return "The tipping window for this order has closed";
        }
        return null;
    }

    private Date closesAt(Order order) {
        if (order.getOrderStatus() != OrderStatus.DELIVERED) return null;
        Date deliveredAt = order.reachedAt(OrderStatus.DELIVERED);
        return deliveredAt == null ? null
                : Date.from(deliveredAt.toInstant().plus(Duration.ofHours(configService.getTipWindowHours())));
    }

    private double paidPostDeliveryTip(String orderId) {
        return paymentRepository.findByOrderIdAndType(orderId, PaymentType.TIP).stream()
                .filter(p -> p.getStatus() == PaymentRecordStatus.PAID)
                .mapToDouble(Payment::getAmount)
                .sum();
    }

    private Order requireCustomerOrder(String userId, String orderId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Order not found"));
        if (userId == null || !userId.equals(order.getCustomerId())) {
            throw new IllegalArgumentException("Only the customer can tip on this order");
        }
        return order;
    }

    private static String shortId(String id) {
        return id.length() <= 6 ? id.toUpperCase() : id.substring(id.length() - 6).toUpperCase();
    }
}
