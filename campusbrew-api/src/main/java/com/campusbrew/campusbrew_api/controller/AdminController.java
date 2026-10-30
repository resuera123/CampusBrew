package com.campusbrew.campusbrew_api.controller;

import com.campusbrew.campusbrew_api.model.ApplicationStatus;
import com.campusbrew.campusbrew_api.model.ReportStatus;
import com.campusbrew.campusbrew_api.model.UserRole;
import com.campusbrew.campusbrew_api.repository.UserRepository;
import com.campusbrew.campusbrew_api.service.AdminService;
import com.campusbrew.campusbrew_api.service.DasherApplicationService;
import com.campusbrew.campusbrew_api.service.JwtService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.function.Function;

/**
 * Admin console: dasher applications, user reports and suspensions. Every call
 * checks that the caller's account is an ADMIN (403 otherwise).
 */
@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final DasherApplicationService applicationService;
    private final AdminService adminService;
    private final UserRepository userRepository;
    private final JwtService jwtService;

    // ─── Dasher applications ────────────────────────────────────

    /** status = PENDING (default) | APPROVED | REJECTED | ALL */
    @GetMapping("/applications")
    public ResponseEntity<?> applications(
            @RequestHeader("Authorization") String authHeader,
            @RequestParam(defaultValue = "PENDING") String status) {
        return asAdmin(authHeader, admin -> applicationService.list(
                "ALL".equalsIgnoreCase(status) ? null : ApplicationStatus.valueOf(status.toUpperCase())));
    }

    @GetMapping("/applications/{id}")
    public ResponseEntity<?> application(@RequestHeader("Authorization") String authHeader, @PathVariable String id) {
        return asAdmin(authHeader, admin -> applicationService.get(id));
    }

    @PutMapping("/applications/{id}/approve")
    public ResponseEntity<?> approve(@RequestHeader("Authorization") String authHeader, @PathVariable String id) {
        return asAdmin(authHeader, admin -> applicationService.approve(admin, id));
    }

    @PutMapping("/applications/{id}/reject")
    public ResponseEntity<?> reject(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable String id,
            @RequestBody Map<String, String> body) {
        return asAdmin(authHeader, admin -> applicationService.reject(admin, id, body.get("reason")));
    }

    // ─── Reports ────────────────────────────────────────────────

    /** status = OPEN (default) | RESOLVED | ALL */
    @GetMapping("/reports")
    public ResponseEntity<?> reports(
            @RequestHeader("Authorization") String authHeader,
            @RequestParam(defaultValue = "OPEN") String status) {
        return asAdmin(authHeader, admin -> adminService.reports(
                "ALL".equalsIgnoreCase(status) ? null : ReportStatus.valueOf(status.toUpperCase())));
    }

    @GetMapping("/reports/{id}")
    public ResponseEntity<?> report(@RequestHeader("Authorization") String authHeader, @PathVariable String id) {
        return asAdmin(authHeader, admin -> adminService.report(id));
    }

    @PutMapping("/reports/{id}/resolve")
    public ResponseEntity<?> resolve(@RequestHeader("Authorization") String authHeader, @PathVariable String id) {
        return asAdmin(authHeader, admin -> adminService.resolve(admin, id));
    }

    // ─── Suspensions ────────────────────────────────────────────

    @PutMapping("/users/{userId}/suspend")
    public ResponseEntity<?> suspend(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable String userId,
            @RequestBody(required = false) Map<String, String> body) {
        return asAdmin(authHeader, admin -> {
            adminService.suspend(admin, userId, body == null ? null : body.get("reason"));
            return Map.of("suspended", true);
        });
    }

    @PutMapping("/users/{userId}/unsuspend")
    public ResponseEntity<?> unsuspend(@RequestHeader("Authorization") String authHeader, @PathVariable String userId) {
        return asAdmin(authHeader, admin -> {
            adminService.unsuspend(userId);
            return Map.of("suspended", false);
        });
    }

    /** Runs the action with the admin's user id, or answers 403 if the caller isn't an admin. */
    private ResponseEntity<?> asAdmin(String authHeader, Function<String, Object> action) {
        String userId;
        try {
            userId = jwtService.extractUserId(authHeader.replace("Bearer ", ""));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Not signed in"));
        }
        boolean admin = userRepository.findById(userId)
                .map(u -> u.getRole() == UserRole.ADMIN && !u.isSuspended())
                .orElse(false);
        if (!admin) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Admins only"));
        }
        try {
            return ResponseEntity.ok(action.apply(userId));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        }
    }
}
