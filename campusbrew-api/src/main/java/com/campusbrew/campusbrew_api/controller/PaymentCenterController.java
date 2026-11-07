package com.campusbrew.campusbrew_api.controller;

import com.campusbrew.campusbrew_api.service.JwtService;
import com.campusbrew.campusbrew_api.service.PaymentCenterService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * v2.0 FR-4.8 — Payment Center endpoints. Permitted in SecurityConfig
 * (/api/payments/**) and the JWT is validated here, like the other controllers.
 */
@RestController
@RequestMapping("/api/payments")
@RequiredArgsConstructor
public class PaymentCenterController {

    private final PaymentCenterService paymentCenterService;
    private final JwtService jwtService;

    @GetMapping("/me")
    public ResponseEntity<?> myPayments(
            @RequestHeader("Authorization") String authHeader,
            @RequestParam(value = "type", required = false) String type) {
        try {
            String userId = userIdFrom(authHeader);
            return ResponseEntity.ok(paymentCenterService.forUser(userId, type));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        }
    }

    /** Dasher or shop operator: report a problem with one order's payment. Body {"note"}. */
    @PostMapping("/orders/{orderId}/report")
    public ResponseEntity<?> reportOrder(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable String orderId,
            @RequestBody(required = false) Map<String, String> body) {
        try {
            paymentCenterService.reportOrder(userIdFrom(authHeader), orderId, body == null ? null : body.get("note"));
            return ResponseEntity.ok(Map.of("reported", true));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/orders/{orderId}/report")
    public ResponseEntity<?> orderReported(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable String orderId) {
        try {
            return ResponseEntity.ok(Map.of("reported", paymentCenterService.orderReported(userIdFrom(authHeader), orderId)));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/{id}/report")
    public ResponseEntity<?> report(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable String id,
            @RequestBody(required = false) Map<String, String> body) {
        try {
            String userId = userIdFrom(authHeader);
            String note = body == null ? null : body.get("note");
            paymentCenterService.report(userId, id, note);
            return ResponseEntity.ok(Map.of("reported", true));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        }
    }

    private String userIdFrom(String authHeader) {
        return jwtService.extractUserId(authHeader.replace("Bearer ", ""));
    }
}
