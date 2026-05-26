package com.campusbrew.campusbrew_api.controller;

import com.campusbrew.campusbrew_api.dto.CreateOrderDTO;
import com.campusbrew.campusbrew_api.dto.OrderDTO;
import com.campusbrew.campusbrew_api.dto.ReorderDTO;
import com.campusbrew.campusbrew_api.service.JwtService;
import com.campusbrew.campusbrew_api.service.OrderService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/orders")
@RequiredArgsConstructor
public class OrderController {

    private final OrderService orderService;
    private final JwtService jwtService;

    @PostMapping
    public ResponseEntity<?> createOrder(
            @RequestHeader("Authorization") String authHeader,
            @RequestBody CreateOrderDTO dto) {
        try {
            String userId = userIdFrom(authHeader);
            OrderDTO created = orderService.createOrder(userId, dto);
            return ResponseEntity.status(HttpStatus.CREATED).body(created);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/{orderId}")
    public ResponseEntity<?> getOrder(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable String orderId) {
        try {
            String userId = userIdFrom(authHeader);
            return ResponseEntity.ok(orderService.getOrderForUser(userId, orderId));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/history")
    public ResponseEntity<?> getOrderHistory(
            @RequestHeader("Authorization") String authHeader,
            @RequestParam(value = "page", defaultValue = "0") int page) {
        try {
            String userId = userIdFrom(authHeader);
            Page<OrderDTO> history = orderService.getOrderHistory(userId, page);
            return ResponseEntity.ok(history);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/reorder/{orderId}")
    public ResponseEntity<?> reorder(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable String orderId) {
        try {
            String userId = userIdFrom(authHeader);
            ReorderDTO reorder = orderService.prepareReorder(userId, orderId);
            return ResponseEntity.ok(reorder);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        }
    }

    private String userIdFrom(String authHeader) {
        String token = authHeader.replace("Bearer ", "");
        return jwtService.extractUserId(token);
    }
}
