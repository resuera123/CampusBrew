package com.campusbrew.campusbrew_api.controller;

import com.campusbrew.campusbrew_api.service.JwtService;
import com.campusbrew.campusbrew_api.service.SalesReportService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * v2.0 FR-4.6 — the operator's daily / weekly sales report. Under /api/shops/**
 * (permitted in SecurityConfig); the JWT is validated here and the operator's own
 * shop is used.
 */
@RestController
@RequestMapping("/api/shops/sales/report")
@RequiredArgsConstructor
public class SalesReportController {

    private final SalesReportService salesReportService;
    private final JwtService jwtService;

    /** range = "day" (default) or "week"; offset = periods back (0 = today / this week). */
    @GetMapping
    public ResponseEntity<?> report(
            @RequestHeader("Authorization") String authHeader,
            @RequestParam(value = "range", defaultValue = "day") String range,
            @RequestParam(value = "offset", defaultValue = "0") int offset) {
        try {
            String userId = jwtService.extractUserId(authHeader.replace("Bearer ", ""));
            return ResponseEntity.ok(salesReportService.report(userId, range, offset));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        }
    }
}
