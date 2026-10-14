package com.campusbrew.campusbrew_api.service;

import com.campusbrew.campusbrew_api.dto.OrderDTO;
import com.campusbrew.campusbrew_api.model.Order;
import com.campusbrew.campusbrew_api.model.Payment;
import com.campusbrew.campusbrew_api.model.PaymentMethod;
import com.campusbrew.campusbrew_api.model.PaymentRecordStatus;
import com.campusbrew.campusbrew_api.model.PaymentStatus;
import com.campusbrew.campusbrew_api.model.PaymentType;
import com.campusbrew.campusbrew_api.payment.InvalidCallbackTokenException;
import com.campusbrew.campusbrew_api.payment.PaymentException;
import com.campusbrew.campusbrew_api.payment.XenditClient;
import com.campusbrew.campusbrew_api.repository.PaymentRepository;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Optional;

/**
 * v2.0 FR-4.1/4.8 — payment orchestration.
 *
 * COD keeps the v1.1 behaviour (order created immediately, PENDING_COD). GCash is
 * payment-first: a {@link Payment} holds the validated order draft, and the order is
 * materialized only when a verified PAID webhook arrives (see {@code processWebhook}).
 *
 * This service deliberately has no dependency on OrderService — the webhook controller
 * orchestrates the two so there is no circular dependency.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PaymentService {

    /** PENDING payments older than this are swept to EXPIRED by the scheduler. */
    public static final long EXPIRY_MINUTES = 15;

    private final PaymentRepository paymentRepository;
    private final XenditClient xenditClient;
    private final ConfigService configService;

    // ---- COD (unchanged v1.1 contract) ----

    public PaymentInitResult initiate(Order order) {
        if (order.getPaymentMethod() == PaymentMethod.COD) {
            return new PaymentInitResult(PaymentStatus.PENDING_COD, null);
        }
        // GCash no longer flows through here — OrderService routes it to
        // initiateGcashCheckout so no order is persisted before payment.
        return new PaymentInitResult(PaymentStatus.PENDING, null);
    }

    // ---- GCash: payment-first (FR-4.1) ----

    /**
     * Persist a PENDING payment carrying the order draft, open a Xendit GCash charge,
     * and return an OrderDTO flagged paymentRequired with the checkout URL + payment id.
     * No order is created yet.
     */
    public OrderDTO initiateGcashCheckout(Order draft, String userId, String shopName) {
        Payment payment = Payment.builder()
                .userId(userId)
                .type(PaymentType.ORDER)
                .method(PaymentMethod.GCASH)
                .amount(draft.getTotalAmount())
                .status(PaymentRecordStatus.PENDING)
                .orderDraft(draft)
                .webhookEvents(new ArrayList<>())
                .createdAt(Date.from(Instant.now()))
                .build();
        payment = paymentRepository.save(payment);

        XenditClient.ChargeResult charge =
                xenditClient.createGcashCharge(payment.getId(), payment.getAmount());
        payment.setGatewayChargeId(charge.chargeId());
        paymentRepository.save(payment);

        return OrderDTO.paymentRequired(draft, shopName, payment.getId(), charge.checkoutUrl());
    }

    // ---- Webhook (FR-4.1) ----

    /**
     * Validate and apply a Xendit webhook. Does NOT create the order itself (no
     * OrderService dependency) — the caller creates it when {@code shouldCreateOrder}
     * is true, using {@code getPayment()}.
     *
     * @throws InvalidCallbackTokenException if the callback token is wrong/absent (→ 403)
     */
    public WebhookOutcome processWebhook(String callbackToken, JsonNode payload) {
        String expected = configService.getXenditCallbackToken();
        if (expected == null || expected.isBlank() || !expected.equals(callbackToken)) {
            throw new InvalidCallbackTokenException("Invalid x-callback-token");
        }

        JsonNode data = payload.path("data").isMissingNode() ? payload : payload.path("data");
        String referenceId = text(data, "reference_id");   // == our payment id
        String chargeId = text(data, "id");
        String status = text(data, "status");               // SUCCEEDED | FAILED | VOIDED | ...
        double amount = amountOf(data);

        // Prefer lookup by reference_id (our payment id); fall back to the charge id.
        Payment payment = findPayment(referenceId, chargeId);
        if (payment == null) {
            log.warn("Webhook for unknown payment (ref={}, charge={})", referenceId, chargeId);
            return WebhookOutcome.noop();
        }

        // Audit trail + idempotency record.
        if (payment.getWebhookEvents() == null) payment.setWebhookEvents(new ArrayList<>());
        payment.getWebhookEvents().add(payloadToPlain(payload));

        // Idempotent: a PAID payment is terminal — record the event, create nothing more.
        if (payment.getStatus() == PaymentRecordStatus.PAID) {
            paymentRepository.save(payment);
            log.info("Duplicate webhook for already-PAID payment {} — ignored", payment.getId());
            return WebhookOutcome.noop();
        }

        if (isSucceeded(status)) {
            // Amount must match what we charged.
            if (Math.abs(amount - payment.getAmount()) > 0.01) {
                log.error("Webhook amount {} != expected {} for payment {} — not completing",
                        amount, payment.getAmount(), payment.getId());
                paymentRepository.save(payment);
                return WebhookOutcome.noop();
            }
            payment.setStatus(PaymentRecordStatus.PAID);
            payment.setReferenceNo(chargeId);
            Payment saved = paymentRepository.save(payment);
            // Create the order only for an ORDER payment that has not already produced one.
            boolean createOrder = saved.getType() == PaymentType.ORDER && saved.getOrderId() == null;
            return new WebhookOutcome(saved, createOrder);
        }

        if (isFailed(status)) {
            payment.setStatus(PaymentRecordStatus.FAILED);
            paymentRepository.save(payment);
            return WebhookOutcome.noop();
        }

        // Unknown/intermediate status — record and wait.
        paymentRepository.save(payment);
        return WebhookOutcome.noop();
    }

    /** Link a materialized order back to its payment (called after the order is created). */
    public void attachOrder(String paymentId, String orderId) {
        paymentRepository.findById(paymentId).ifPresent(p -> {
            p.setOrderId(orderId);
            paymentRepository.save(p);
        });
    }

    // ---- Expiry (FR-4.1) ----

    /** Sweep PENDING payments older than EXPIRY_MINUTES to EXPIRED. Returns the count expired. */
    public int expireStalePending() {
        Date cutoff = Date.from(Instant.now().minusSeconds(EXPIRY_MINUTES * 60));
        List<Payment> stale = paymentRepository.findByStatus(PaymentRecordStatus.PENDING).stream()
                .filter(p -> p.getCreatedAt() != null && p.getCreatedAt().before(cutoff))
                .toList();
        stale.forEach(p -> {
            p.setStatus(PaymentRecordStatus.EXPIRED);
            paymentRepository.save(p);
        });
        if (!stale.isEmpty()) {
            log.info("Expired {} stale PENDING payment(s)", stale.size());
        }
        return stale.size();
    }

    // ---- Refund (FR-4.1, used by shop reject / customer cancel) ----

    /** Refund the GCash payment for an order, if one was PAID. No-op for COD/unpaid. */
    public void refund(String orderId) {
        Optional<Payment> maybe = paymentRepository.findByOrderId(orderId);
        if (maybe.isEmpty()) {
            return;
        }
        Payment payment = maybe.get();
        if (payment.getStatus() != PaymentRecordStatus.PAID
                || payment.getGatewayChargeId() == null) {
            return;
        }
        xenditClient.refund(payment.getGatewayChargeId(), payment.getAmount());
        payment.setStatus(PaymentRecordStatus.REFUNDED);
        paymentRepository.save(payment);
    }

    // ---- helpers ----

    private Payment findPayment(String referenceId, String chargeId) {
        if (referenceId != null && !referenceId.isBlank()) {
            Optional<Payment> byRef = paymentRepository.findById(referenceId);
            if (byRef.isPresent()) return byRef.get();
        }
        if (chargeId != null && !chargeId.isBlank()) {
            return paymentRepository.findByGatewayChargeId(chargeId).orElse(null);
        }
        return null;
    }

    private static boolean isSucceeded(String status) {
        return "SUCCEEDED".equalsIgnoreCase(status) || "PAID".equalsIgnoreCase(status)
                || "COMPLETED".equalsIgnoreCase(status) || "CAPTURED".equalsIgnoreCase(status);
    }

    private static boolean isFailed(String status) {
        return "FAILED".equalsIgnoreCase(status) || "VOIDED".equalsIgnoreCase(status)
                || "EXPIRED".equalsIgnoreCase(status) || "CANCELED".equalsIgnoreCase(status)
                || "CANCELLED".equalsIgnoreCase(status);
    }

    private static String text(JsonNode node, String field) {
        String v = node.path(field).asText(null);
        return (v == null || v.isBlank()) ? null : v;
    }

    private static double amountOf(JsonNode data) {
        for (String f : new String[]{"charge_amount", "capture_amount", "amount"}) {
            if (data.has(f)) return data.path(f).asDouble();
        }
        return -1;
    }

    private static Object payloadToPlain(JsonNode payload) {
        // Store a compact string form; enough for audit without a strict schema.
        return payload.toString();
    }

    @Data
    @AllArgsConstructor
    public static class PaymentInitResult {
        private PaymentStatus status;
        private String paymentUrl;
    }

    /** Outcome of a webhook: the (updated) payment and whether the caller must create the order. */
    @Data
    @AllArgsConstructor
    public static class WebhookOutcome {
        private Payment payment;
        private boolean shouldCreateOrder;

        static WebhookOutcome noop() {
            return new WebhookOutcome(null, false);
        }
    }
}
