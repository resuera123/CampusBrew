package com.campusbrew.campusbrew_api.service;

import com.campusbrew.campusbrew_api.dto.AuthResponse;
import com.campusbrew.campusbrew_api.dto.LoginRequest;
import com.campusbrew.campusbrew_api.dto.OtpRequest;
import com.campusbrew.campusbrew_api.dto.RegisterRequest;
import com.campusbrew.campusbrew_api.model.Otp;
import com.campusbrew.campusbrew_api.model.OtpType;
import com.campusbrew.campusbrew_api.model.User;
import com.campusbrew.campusbrew_api.model.VerificationStatus;
import com.campusbrew.campusbrew_api.repository.OtpRepository;
import com.campusbrew.campusbrew_api.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Instant;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final OtpRepository otpRepository;
    private final JwtService jwtService;
    private final EmailService emailService;
    private final PasswordEncoder passwordEncoder;

    // ─── 1.1 Registration ───────────────────────────────────────

    public void register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new RuntimeException("Email already registered");
        }

        User user = User.builder()
                .fullName(request.getFullName())
                .email(request.getEmail())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .role(request.getRole())
                .verificationStatus(VerificationStatus.UNVERIFIED)
                .emailVerified(false)
                .createdAt(java.util.Date.from(Instant.now()))
                .updatedAt(java.util.Date.from(Instant.now()))
                .build();

        userRepository.save(user);

        String otp = generateOtp();
        saveOtp(request.getEmail(), otp, OtpType.REGISTRATION);
        emailService.sendOtpEmail(request.getEmail(), otp);
    }

    public void verifyOtp(OtpRequest request) {
        Otp otp = otpRepository
                .findByEmailAndTypeOrderByCreatedAtDesc(request.getEmail(), OtpType.REGISTRATION)
                .orElseThrow(() -> new RuntimeException("OTP not found"));

        if (otp.getExpiresAt().isBefore(Instant.now())) {
            throw new RuntimeException("OTP has expired");
        }

        if (!otp.getCode().equals(request.getOtp())) {
            throw new RuntimeException("Invalid OTP");
        }

        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new RuntimeException("User not found"));
        user.setEmailVerified(true);
        userRepository.save(user);

        otpRepository.deleteByEmailAndType(request.getEmail(), OtpType.REGISTRATION);
    }

    public void resendOtp(String email) {
        userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("Email not found"));

        otpRepository.deleteByEmailAndType(email, OtpType.REGISTRATION);

        String otp = generateOtp();
        saveOtp(email, otp, OtpType.REGISTRATION);
        emailService.sendOtpEmail(email, otp);
    }

    // ─── 1.2 Login ──────────────────────────────────────────────

    public AuthResponse login(LoginRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new RuntimeException("Invalid email or password"));

        if (!user.isEmailVerified()) {
            throw new RuntimeException("Please verify your email first");
        }

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new RuntimeException("Invalid email or password");
        }

        String token = jwtService.generateToken(user);

        return AuthResponse.builder()
                .token(token)
                .userId(user.getId())
                .fullName(user.getFullName())
                .role(user.getRole())
                .verificationStatus(user.getVerificationStatus())
                .build();
    }

    // ─── 1.3 Forgot / Reset Password ────────────────────────────

    public void forgotPassword(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("No account found with this email"));

        // Clean up any existing reset codes
        otpRepository.deleteByEmailAndType(email, OtpType.PASSWORD_RESET);

        String code = generateOtp();
        saveOtp(email, code, OtpType.PASSWORD_RESET);
        emailService.sendPasswordResetEmail(email, code);
    }

    public void resetPassword(String email, String code, String newPassword) {
        // Validate the code
        Otp otp = otpRepository
                .findByEmailAndTypeOrderByCreatedAtDesc(email, OtpType.PASSWORD_RESET)
                .orElseThrow(() -> new RuntimeException("Reset code not found. Please request a new one."));

        if (otp.getExpiresAt().isBefore(Instant.now())) {
            throw new RuntimeException("Reset code has expired. Please request a new one.");
        }

        if (!otp.getCode().equals(code)) {
            throw new RuntimeException("Invalid verification code");
        }

        // Validate new password
        if (newPassword == null || newPassword.length() < 8) {
            throw new RuntimeException("Password must be at least 8 characters");
        }

        // Update password
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        user.setUpdatedAt(java.util.Date.from(Instant.now()));
        userRepository.save(user);

        // Clean up used code
        otpRepository.deleteByEmailAndType(email, OtpType.PASSWORD_RESET);
    }

    // ─── Helpers ────────────────────────────────────────────────

    private String generateOtp() {
        return String.format("%06d", new SecureRandom().nextInt(999999));
    }

    private void saveOtp(String email, String code, OtpType type) {
        Otp otp = Otp.builder()
                .email(email)
                .code(code)
                .type(type)
                .expiresAt(Instant.now().plusSeconds(300)) // 5 minutes
                .createdAt(Instant.now())
                .build();
        otpRepository.save(otp);
    }
}