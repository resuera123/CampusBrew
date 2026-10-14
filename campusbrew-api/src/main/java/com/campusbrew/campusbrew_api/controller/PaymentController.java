package com.campusbrew.campusbrew_api.controller;

import com.campusbrew.campusbrew_api.model.Payment;
import com.campusbrew.campusbrew_api.repository.PaymentRepository;
import com.campusbrew.campusbrew_api.service.JwtService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * v2.0 FR-4.1 — the client polls GET /api/payments/{id} after opening the GCash
 * checkout, until the status leaves PENDING. (The fuller Payment Center endpoints
 * for FR-4.8 are a separate task.)
 */
@RestController
@RequestMapping("/api/payments")
@RequiredArgsConstructor
public class PaymentController {

    private final PaymentRepository paymentRepository;
    private final JwtService jwtService;

    @GetMapping("/{id}")
    public ResponseEntity<?> getPayment(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable String id) {
        String userId;
        try {
            userId = jwtService.extractUserId(authHeader.replace("Bearer ", ""));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Invalid token"));
        }

        Payment payment = paymentRepository.findById(id).orElse(null);
        if (payment == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Payment not found"));
        }
        if (!userId.equals(payment.getUserId())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Not your payment"));
        }

        // Lean status view for polling — never leak the order draft or raw webhook events.
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("id", payment.getId());
        body.put("status", payment.getStatus());
        body.put("type", payment.getType());
        body.put("method", payment.getMethod());
        body.put("amount", payment.getAmount());
        body.put("orderId", payment.getOrderId());
        body.put("referenceNo", payment.getReferenceNo());
        return ResponseEntity.ok(body);
    }
}
