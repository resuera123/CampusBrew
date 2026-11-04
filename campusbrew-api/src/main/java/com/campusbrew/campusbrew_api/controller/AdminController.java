package com.campusbrew.campusbrew_api.controller;

import com.campusbrew.campusbrew_api.model.ApplicationStatus;
import com.campusbrew.campusbrew_api.model.ReportStatus;
import com.campusbrew.campusbrew_api.model.UserRole;
import com.campusbrew.campusbrew_api.repository.UserRepository;
import com.campusbrew.campusbrew_api.service.AdminService;
import com.campusbrew.campusbrew_api.service.DasherApplicationService;
import com.campusbrew.campusbrew_api.service.JwtService;
import com.campusbrew.campusbrew_api.service.ShopApplicationService;
import com.campusbrew.campusbrew_api.service.SupportService;
import com.campusbrew.campusbrew_api.service.VerificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.function.Function;

/**
 * Admin console: verification requests, dasher and shop applications, user reports,
 * support messages and suspensions. Every call
 * checks that the caller's account is an ADMIN (403 otherwise).
 */
@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final DasherApplicationService applicationService;
    private final ShopApplicationService shopApplicationService;
    private final AdminService adminService;
    private final VerificationService verificationService;
    private final SupportService supportService;
    private final UserRepository userRepository;
    private final JwtService jwtService;

    // ─── Verification requests ──────────────────────────────────

    /** status = PENDING (default) | APPROVED | REJECTED | ALL */
    @GetMapping("/verifications")
    public ResponseEntity<?> verifications(
            @RequestHeader("Authorization") String authHeader,
            @RequestParam(defaultValue = "PENDING") String status) {
        return asAdmin(authHeader, admin -> verificationService.list(
                "ALL".equalsIgnoreCase(status) ? null : ApplicationStatus.valueOf(status.toUpperCase())));
    }

    @GetMapping("/verifications/{id}")
    public ResponseEntity<?> verification(@RequestHeader("Authorization") String authHeader, @PathVariable String id) {
        return asAdmin(authHeader, admin -> verificationService.get(id));
    }

    @PutMapping("/verifications/{id}/approve")
    public ResponseEntity<?> approveVerification(@RequestHeader("Authorization") String authHeader, @PathVariable String id) {
        return asAdmin(authHeader, admin -> verificationService.approve(admin, id));
    }

    @PutMapping("/verifications/{id}/reject")
    public ResponseEntity<?> rejectVerification(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable String id,
            @RequestBody Map<String, String> body) {
        return asAdmin(authHeader, admin -> verificationService.reject(admin, id, body.get("reason")));
    }

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

    // ─── Shop applications ──────────────────────────────────────

    /** status = PENDING (default) | APPROVED | REJECTED | ALL */
    @GetMapping("/shop-applications")
    public ResponseEntity<?> shopApplications(
            @RequestHeader("Authorization") String authHeader,
            @RequestParam(defaultValue = "PENDING") String status) {
        return asAdmin(authHeader, admin -> shopApplicationService.list(
                "ALL".equalsIgnoreCase(status) ? null : ApplicationStatus.valueOf(status.toUpperCase())));
    }

    @GetMapping("/shop-applications/{id}")
    public ResponseEntity<?> shopApplication(@RequestHeader("Authorization") String authHeader, @PathVariable String id) {
        return asAdmin(authHeader, admin -> shopApplicationService.get(id));
    }

    @PutMapping("/shop-applications/{id}/approve")
    public ResponseEntity<?> approveShop(@RequestHeader("Authorization") String authHeader, @PathVariable String id) {
        return asAdmin(authHeader, admin -> shopApplicationService.approve(admin, id));
    }

    @PutMapping("/shop-applications/{id}/reject")
    public ResponseEntity<?> rejectShop(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable String id,
            @RequestBody Map<String, String> body) {
        return asAdmin(authHeader, admin -> shopApplicationService.reject(admin, id, body.get("reason")));
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

    // ─── Support messages ───────────────────────────────────────

    /** status = OPEN (default) | RESOLVED | ALL */
    @GetMapping("/support")
    public ResponseEntity<?> support(
            @RequestHeader("Authorization") String authHeader,
            @RequestParam(defaultValue = "OPEN") String status) {
        return asAdmin(authHeader, admin -> supportService.list(
                "ALL".equalsIgnoreCase(status) ? null : ReportStatus.valueOf(status.toUpperCase())));
    }

    @GetMapping("/support/{id}")
    public ResponseEntity<?> supportTicket(@RequestHeader("Authorization") String authHeader, @PathVariable String id) {
        return asAdmin(authHeader, admin -> supportService.get(id));
    }

    @PutMapping("/support/{id}/resolve")
    public ResponseEntity<?> resolveSupport(@RequestHeader("Authorization") String authHeader, @PathVariable String id) {
        return asAdmin(authHeader, admin -> supportService.resolve(admin, id));
    }

    // ─── Suspensions ────────────────────────────────────────────

    @GetMapping("/users/suspended")
    public ResponseEntity<?> suspendedUsers(@RequestHeader("Authorization") String authHeader) {
        return asAdmin(authHeader, admin -> adminService.suspendedUsers());
    }

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
