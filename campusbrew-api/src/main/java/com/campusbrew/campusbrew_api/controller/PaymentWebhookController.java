package com.campusbrew.campusbrew_api.controller;

import com.campusbrew.campusbrew_api.payment.InvalidCallbackTokenException;
import com.campusbrew.campusbrew_api.service.OrderService;
import com.campusbrew.campusbrew_api.service.PaymentService;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * v2.0 FR-4.1 — Xendit payment webhook. No JWT (permitted in SecurityConfig); the
 * x-callback-token header is the authentication. Orchestrates the two services so
 * neither depends on the other: PaymentService applies the status change, and on a
 * verified PAID this controller asks OrderService to create the order.
 */
@Slf4j
@RestController
@RequestMapping("/api/payments/webhook")
@RequiredArgsConstructor
public class PaymentWebhookController {

    private final PaymentService paymentService;
    private final OrderService orderService;

    @PostMapping("/xendit")
    public ResponseEntity<?> xendit(
            @RequestHeader(value = "x-callback-token", required = false) String callbackToken,
            @RequestBody JsonNode payload) {
        try {
            PaymentService.WebhookOutcome outcome = paymentService.processWebhook(callbackToken, payload);
            if (outcome.isShouldCreateOrder()) {
                orderService.createPaidOrderFromDraft(outcome.getPayment());
            }
            // Always 200 for a processed (or no-op) webhook so Xendit stops retrying.
            return ResponseEntity.ok(Map.of("received", true));
        } catch (InvalidCallbackTokenException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            // Let Xendit retry on genuine processing errors.
            log.error("Webhook processing failed: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "processing failed"));
        }
    }
}
