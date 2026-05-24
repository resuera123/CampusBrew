package com.campusbrew.campusbrew_api.controller;

import com.campusbrew.campusbrew_api.dto.SchoolEmailRequest;
import com.campusbrew.campusbrew_api.dto.VerificationRequest;
import com.campusbrew.campusbrew_api.service.JwtService;
import com.campusbrew.campusbrew_api.service.VerificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/verification")
@RequiredArgsConstructor
public class VerificationController {

    private final VerificationService verificationService;
    private final JwtService jwtService;

    @PostMapping("/send-otp")
    public ResponseEntity<?> sendSchoolOtp(
            @RequestHeader("Authorization") String authHeader,
            @RequestBody SchoolEmailRequest request) {
        try {
            String token = authHeader.replace("Bearer ", "");
            String userId = jwtService.extractUserId(token);
            verificationService.sendSchoolOtp(userId, request.getSchoolEmail());
            return ResponseEntity.ok(Map.of("message", "OTP sent to your CIT-U email"));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/verify")
    public ResponseEntity<?> verify(
            @RequestHeader("Authorization") String authHeader,
            @RequestBody VerificationRequest request) {
        try {
            String token = authHeader.replace("Bearer ", "");
            String userId = jwtService.extractUserId(token);
            verificationService.verify(userId, request.getSchoolEmail(), request.getOtp(), request.getStudentId());
            return ResponseEntity.ok(Map.of("message", "Account verified successfully! COD is now unlocked."));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", e.getMessage()));
        }
    }
}
