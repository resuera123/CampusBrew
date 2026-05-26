package com.campusbrew.campusbrew_api.controller;

import com.campusbrew.campusbrew_api.service.DeliveryFulfillmentService;
import com.campusbrew.campusbrew_api.service.JwtService;
import com.campusbrew.campusbrew_api.service.OrderService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/delivery/orders")
@RequiredArgsConstructor
public class DeliveryFulfillmentController {

    private final DeliveryFulfillmentService service;
    private final OrderService orderService;
    private final JwtService jwtService;

    @GetMapping("/available")
    public ResponseEntity<?> getAvailable(@RequestHeader("Authorization") String authHeader) {
        try {
            String userId = userIdFrom(authHeader);
            return ResponseEntity.ok(orderService.getAvailableDeliveries(userId));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/history")
    public ResponseEntity<?> getHistory(@RequestHeader("Authorization") String authHeader) {
        try {
            String userId = userIdFrom(authHeader);
            return ResponseEntity.ok(orderService.getDeliveryHistory(userId));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/current")
    public ResponseEntity<?> getCurrent(@RequestHeader("Authorization") String authHeader) {
        try {
            String userId = userIdFrom(authHeader);
            return ResponseEntity.ok(service.getCurrentOrder(userId));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/{orderId}/pickup")
    public ResponseEntity<?> pickup(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable String orderId) {
        try {
            String userId = userIdFrom(authHeader);
            return ResponseEntity.ok(service.markPickedUp(userId, orderId));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/{orderId}/complete")
    public ResponseEntity<?> complete(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable String orderId) {
        try {
            String userId = userIdFrom(authHeader);
            return ResponseEntity.ok(service.confirmDelivery(userId, orderId));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        }
    }

    private String userIdFrom(String authHeader) {
        return jwtService.extractUserId(authHeader.replace("Bearer ", ""));
    }
}
