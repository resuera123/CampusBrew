package com.campusbrew.campusbrew_api.controller;

import com.campusbrew.campusbrew_api.dto.StockTrackingDTO;
import com.campusbrew.campusbrew_api.service.InventoryService;
import com.campusbrew.campusbrew_api.service.JwtService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * v2.0 FR-5.5 — the operator's inventory: units sold and stock per item, per-item
 * trends, restocking and stock tracking. Under /api/shops/** (permitted in
 * SecurityConfig); the JWT is validated here and the operator's own shop is used.
 */
@RestController
@RequestMapping("/api/shops/inventory")
@RequiredArgsConstructor
public class InventoryController {

    private final InventoryService inventoryService;
    private final JwtService jwtService;

    /** range = "today" (default) or "week". */
    @GetMapping
    public ResponseEntity<?> list(
            @RequestHeader("Authorization") String authHeader,
            @RequestParam(value = "range", defaultValue = "today") String range) {
        try {
            return ResponseEntity.ok(inventoryService.list(userIdFrom(authHeader), range));
        } catch (RuntimeException e) {
            return badRequest(e);
        }
    }

    /** period = "daily" (default, this week) or "weekly" (last 8 weeks). */
    @GetMapping("/{itemId}/trend")
    public ResponseEntity<?> trend(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable String itemId,
            @RequestParam(value = "period", defaultValue = "daily") String period) {
        try {
            return ResponseEntity.ok(inventoryService.trend(userIdFrom(authHeader), itemId, period));
        } catch (RuntimeException e) {
            return badRequest(e);
        }
    }

    @PostMapping("/{itemId}/restock")
    public ResponseEntity<?> restock(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable String itemId,
            @RequestBody Map<String, Object> body) {
        try {
            Object raw = body == null ? null : body.get("quantity");
            if (!(raw instanceof Number qty)) {
                throw new IllegalArgumentException("Enter a restock quantity");
            }
            return ResponseEntity.ok(inventoryService.restock(userIdFrom(authHeader), itemId, qty.intValue()));
        } catch (RuntimeException e) {
            return badRequest(e);
        }
    }

    @PutMapping("/{itemId}/tracking")
    public ResponseEntity<?> tracking(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable String itemId,
            @RequestBody StockTrackingDTO body) {
        try {
            return ResponseEntity.ok(inventoryService.setTracking(userIdFrom(authHeader), itemId, body));
        } catch (RuntimeException e) {
            return badRequest(e);
        }
    }

    private static ResponseEntity<?> badRequest(RuntimeException e) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
    }

    private String userIdFrom(String authHeader) {
        return jwtService.extractUserId(authHeader.replace("Bearer ", ""));
    }
}
