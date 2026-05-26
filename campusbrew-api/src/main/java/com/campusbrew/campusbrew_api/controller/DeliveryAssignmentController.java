package com.campusbrew.campusbrew_api.controller;

import com.campusbrew.campusbrew_api.service.DeliveryAssignmentEngine;
import com.campusbrew.campusbrew_api.service.JwtService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/delivery/assignments")
@RequiredArgsConstructor
public class DeliveryAssignmentController {

    private final DeliveryAssignmentEngine engine;
    private final JwtService jwtService;

    @PutMapping("/{orderId}/accept")
    public ResponseEntity<?> accept(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable String orderId) {
        try {
            String userId = userIdFrom(authHeader);
            engine.acceptAssignment(userId, orderId);
            return ResponseEntity.ok(Map.of("orderId", orderId, "status", "ACCEPTED"));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Marketplace claim — invoked when a DP taps an order from the available list
     * (no active offer pending). Atomic first-wins via MongoTemplate findAndModify.
     */
    @PutMapping("/{orderId}/claim")
    public ResponseEntity<?> claim(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable String orderId) {
        try {
            String userId = userIdFrom(authHeader);
            engine.claimFromMarketplace(userId, orderId);
            return ResponseEntity.ok(Map.of("orderId", orderId, "status", "ASSIGNED"));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/{orderId}/decline")
    public ResponseEntity<?> decline(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable String orderId) {
        try {
            String userId = userIdFrom(authHeader);
            engine.declineAssignment(userId, orderId);
            return ResponseEntity.ok(Map.of("orderId", orderId, "status", "DECLINED"));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        }
    }

    private String userIdFrom(String authHeader) {
        return jwtService.extractUserId(authHeader.replace("Bearer ", ""));
    }
}
