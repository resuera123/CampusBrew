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

import java.time.Instant;
import java.util.Random;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final OtpRepository otpRepository;
    private final JwtService jwtService;
    private final EmailService emailService;
    private final PasswordEncoder passwordEncoder;

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

        // Generate and send OTP
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

        // Mark email as verified
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new RuntimeException("User not found"));
        user.setEmailVerified(true);
        userRepository.save(user);

        // Clean up used OTP
        otpRepository.deleteByEmailAndType(request.getEmail(), OtpType.REGISTRATION);
    }

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

    public void resendOtp(String email) {
        userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("Email not found"));

        otpRepository.deleteByEmailAndType(email, OtpType.REGISTRATION);

        String otp = generateOtp();
        saveOtp(email, otp, OtpType.REGISTRATION);
        emailService.sendOtpEmail(email, otp);
    }

    private String generateOtp() {
        return String.format("%06d", new Random().nextInt(999999));
    }

    private void saveOtp(String email, String code, OtpType type) {
        Otp otp = Otp.builder()
                .email(email)
                .code(code)
                .type(type)
                .expiresAt(Instant.now().plusSeconds(300))
                .createdAt(Instant.now())
                .build();
        otpRepository.save(otp);
    }
}