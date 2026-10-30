package com.campusbrew.campusbrew_api.controller;

import com.campusbrew.campusbrew_api.dto.DasherApplicationRequest;
import com.campusbrew.campusbrew_api.model.UserRole;
import com.campusbrew.campusbrew_api.service.AuthService;
import com.campusbrew.campusbrew_api.service.DasherApplicationService;
import com.campusbrew.campusbrew_api.service.JwtService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Become a Dasher (the customer's side) and the customer ⇄ dasher switch.
 * Lives under /api/users/me so it is permitted in SecurityConfig; the JWT is
 * validated here like the other controllers.
 */
@RestController
@RequestMapping("/api/users/me")
@RequiredArgsConstructor
public class DasherApplicationController {

    private final DasherApplicationService applicationService;
    private final AuthService authService;
    private final JwtService jwtService;

    @GetMapping("/dasher-application")
    public ResponseEntity<?> status(@RequestHeader("Authorization") String authHeader) {
        try {
            return ResponseEntity.ok(applicationService.status(userIdFrom(authHeader)));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/dasher-application")
    public ResponseEntity<?> apply(
            @RequestHeader("Authorization") String authHeader,
            @RequestBody DasherApplicationRequest request) {
        try {
            return ResponseEntity.ok(applicationService.apply(userIdFrom(authHeader), request));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        }
    }

    /** Body {"role": "CUSTOMER" | "DELIVERY_PERSONNEL"}; returns a fresh session. */
    @PutMapping("/role")
    public ResponseEntity<?> switchRole(
            @RequestHeader("Authorization") String authHeader,
            @RequestBody Map<String, String> body) {
        try {
            UserRole target = UserRole.valueOf(String.valueOf(body.get("role")));
            return ResponseEntity.ok(authService.switchRole(userIdFrom(authHeader), target));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        }
    }

    private String userIdFrom(String authHeader) {
        return jwtService.extractUserId(authHeader.replace("Bearer ", ""));
    }
}
