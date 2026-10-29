package com.campusbrew.campusbrew_api.controller;

import com.campusbrew.campusbrew_api.dto.SubmitRatingsDTO;
import com.campusbrew.campusbrew_api.service.JwtService;
import com.campusbrew.campusbrew_api.service.RatingService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * v2.0 FR-3.6 — the caller's rating form for an order and submitting it. Lives under
 * /api/orders/** so it is permitted in SecurityConfig; the JWT is validated here.
 */
@RestController
@RequestMapping("/api/orders/{orderId}/ratings")
@RequiredArgsConstructor
public class RatingController {

    private final RatingService ratingService;
    private final JwtService jwtService;

    @GetMapping
    public ResponseEntity<?> form(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable String orderId) {
        try {
            return ResponseEntity.ok(ratingService.form(userIdFrom(authHeader), orderId));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping
    public ResponseEntity<?> submit(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable String orderId,
            @RequestBody SubmitRatingsDTO body) {
        try {
            return ResponseEntity.ok(ratingService.submit(userIdFrom(authHeader), orderId, body));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        }
    }

    private String userIdFrom(String authHeader) {
        return jwtService.extractUserId(authHeader.replace("Bearer ", ""));
    }
}
