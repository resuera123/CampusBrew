package com.campusbrew.campusbrew_api.controller;

import com.campusbrew.campusbrew_api.model.OrderStatus;
import com.campusbrew.campusbrew_api.service.JwtService;
import com.campusbrew.campusbrew_api.service.OrderService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/shops")
@RequiredArgsConstructor
public class ShopOrderController {

    private final OrderService orderService;
    private final JwtService jwtService;

    @GetMapping("/{shopId}/orders")
    public ResponseEntity<?> getShopOrders(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable String shopId,
            @RequestParam(value = "status", required = false) String statusCsv) {
        try {
            String userId = userIdFrom(authHeader);
            List<OrderStatus> statuses = parseStatuses(statusCsv);
            return ResponseEntity.ok(orderService.getShopOrders(userId, shopId, statuses));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/orders/{orderId}/accept")
    public ResponseEntity<?> acceptOrder(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable String orderId) {
        try {
            String userId = userIdFrom(authHeader);
            return ResponseEntity.ok(orderService.acceptOrder(userId, orderId));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/orders/{orderId}/reject")
    public ResponseEntity<?> rejectOrder(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable String orderId) {
        try {
            String userId = userIdFrom(authHeader);
            return ResponseEntity.ok(orderService.rejectOrder(userId, orderId));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/orders/{orderId}/ready")
    public ResponseEntity<?> markReady(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable String orderId) {
        try {
            String userId = userIdFrom(authHeader);
            return ResponseEntity.ok(orderService.markReady(userId, orderId));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        }
    }

    private List<OrderStatus> parseStatuses(String csv) {
        if (csv == null || csv.isBlank()) return List.of();
        return Arrays.stream(csv.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .map(s -> OrderStatus.valueOf(s.toUpperCase()))
                .collect(Collectors.toList());
    }

    private String userIdFrom(String authHeader) {
        return jwtService.extractUserId(authHeader.replace("Bearer ", ""));
    }
}
