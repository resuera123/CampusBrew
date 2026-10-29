package com.campusbrew.campusbrew_api.controller;

import com.campusbrew.campusbrew_api.service.JwtService;
import com.campusbrew.campusbrew_api.service.PaymentService;
import com.campusbrew.campusbrew_api.service.TipService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * v2.0 FR-4.7 — post-delivery tip. POST starts a GCash charge and returns
 * {paymentId, paymentUrl}; the client opens the checkout and polls
 * GET /api/payments/{paymentId}, as for an order payment. Lives under
 * /api/orders/** so it is permitted in SecurityConfig; the JWT is validated here.
 */
@RestController
@RequestMapping("/api/orders/{orderId}/tip")
@RequiredArgsConstructor
public class TipController {

    private final TipService tipService;
    private final JwtService jwtService;

    @GetMapping
    public ResponseEntity<?> status(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable String orderId) {
        try {
            return ResponseEntity.ok(tipService.status(userIdFrom(authHeader), orderId));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping
    public ResponseEntity<?> start(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable String orderId,
            @RequestBody Map<String, Object> body) {
        try {
            Object raw = body == null ? null : body.get("amount");
            if (!(raw instanceof Number amount)) {
                throw new IllegalArgumentException("Enter a tip amount");
            }
            PaymentService.TipCharge charge = tipService.start(userIdFrom(authHeader), orderId, amount.doubleValue());
            return ResponseEntity.ok(Map.of("paymentId", charge.paymentId(), "paymentUrl", charge.paymentUrl()));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        }
    }

    private String userIdFrom(String authHeader) {
        return jwtService.extractUserId(authHeader.replace("Bearer ", ""));
    }
}
