package com.campusbrew.campusbrew_api.controller;

import com.campusbrew.campusbrew_api.service.ItemSalesService;
import com.campusbrew.campusbrew_api.service.JwtService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * v2.0 FR-5.5 — the operator's sales by item: the per-item list, one item's trend and
 * the dashboard's all-items chart. Under /api/shops/** (permitted in SecurityConfig);
 * the JWT is validated here and the operator's own shop is used.
 */
@RestController
@RequestMapping("/api/shops/sales/items")
@RequiredArgsConstructor
public class ItemSalesController {

    private final ItemSalesService itemSalesService;
    private final JwtService jwtService;

    /** range = "today" (default) or "week". */
    @GetMapping
    public ResponseEntity<?> list(
            @RequestHeader("Authorization") String authHeader,
            @RequestParam(value = "range", defaultValue = "today") String range) {
        try {
            return ResponseEntity.ok(itemSalesService.list(userIdFrom(authHeader), range));
        } catch (RuntimeException e) {
            return badRequest(e);
        }
    }

    /** range = "7d" (default, per day) or "4w" (per week). */
    @GetMapping("/chart")
    public ResponseEntity<?> chart(
            @RequestHeader("Authorization") String authHeader,
            @RequestParam(value = "range", defaultValue = "7d") String range) {
        try {
            return ResponseEntity.ok(itemSalesService.chart(userIdFrom(authHeader), range));
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
            return ResponseEntity.ok(itemSalesService.trend(userIdFrom(authHeader), itemId, period));
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
