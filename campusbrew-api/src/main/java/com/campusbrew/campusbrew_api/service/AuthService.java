package com.campusbrew.campusbrew_api.service;

import com.campusbrew.campusbrew_api.dto.AuthResponse;
import com.campusbrew.campusbrew_api.dto.LoginRequest;
import com.campusbrew.campusbrew_api.dto.OtpRequest;
import com.campusbrew.campusbrew_api.dto.RegisterRequest;
import com.campusbrew.campusbrew_api.model.DeliveryPersonnel;
import com.campusbrew.campusbrew_api.model.Otp;
import com.campusbrew.campusbrew_api.model.OtpType;
import com.campusbrew.campusbrew_api.model.Shop;
import com.campusbrew.campusbrew_api.model.User;
import com.campusbrew.campusbrew_api.model.UserRole;
import com.campusbrew.campusbrew_api.model.VerificationStatus;
import com.campusbrew.campusbrew_api.repository.DeliveryPersonnelRepository;
import com.campusbrew.campusbrew_api.repository.OtpRepository;
import com.campusbrew.campusbrew_api.repository.ShopRepository;
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
    private final ShopRepository shopRepository;
    private final DeliveryPersonnelRepository deliveryPersonnelRepository;
    private final JwtService jwtService;
    private final EmailService emailService;
    private final PasswordEncoder passwordEncoder;

    // ─── 1.1 Registration ───────────────────────────────────────

    public void register(RegisterRequest request) {
        // Dashers come from an approved application and admins are seeded, so
        // sign-up only creates customers and shop operators.
        if (request.getRole() != UserRole.CUSTOMER && request.getRole() != UserRole.SHOP_OPERATOR) {
            throw new RuntimeException("Sign up as a customer or shop operator");
        }

        // An address that never finished email verification (e.g. the code email
        // failed to send) can sign up again; the details are replaced.
        User existing = userRepository.findByEmail(request.getEmail()).orElse(null);
        if (existing != null && existing.isEmailVerified()) {
            throw new RuntimeException("Email already registered");
        }

        User user = existing != null ? existing : User.builder()
                .email(request.getEmail())
                .verificationStatus(VerificationStatus.UNVERIFIED)
                .emailVerified(false)
                .createdAt(java.util.Date.from(Instant.now()))
                .build();
        user.setFullName(request.getFullName());
        user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        user.setRole(request.getRole());
        user.setUpdatedAt(java.util.Date.from(Instant.now()));

        User saved = userRepository.save(user);

        // Auto-provision a blank Shop for SHOP_OPERATOR users so they have something
        // to manage in the dashboard. They fill in the details via Edit Shop Profile.
        if (saved.getRole() == UserRole.SHOP_OPERATOR && shopRepository.findByOperatorId(saved.getId()).isEmpty()) {
            Shop shop = Shop.builder()
                    .operatorId(saved.getId())
                    .shopName(saved.getFullName() != null ? saved.getFullName() + "'s Shop" : "Untitled Shop")
                    .description("")
                    .location("")
                    .isOpen(false)
                    .approved(false) // hidden until an admin approves its application
                    .build();
            shopRepository.save(shop);
        }

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

        if (user.isSuspended()) {
            throw new RuntimeException("Your account is suspended. Contact CampusBrew support.");
        }

        return authResponse(user);
    }

    // ─── Customer ⇄ Dasher switch ───────────────────────────────

    /** Whether this account may use the dasher side (approved application, or a legacy dasher account). */
    public static boolean isDasher(User user) {
        return user.isDasherApproved() || user.getRole() == UserRole.DELIVERY_PERSONNEL;
    }

    /**
     * Switches the account's active side and returns a fresh session (the JWT
     * carries the role). Going to the customer side takes the dasher offline, so
     * no offers arrive while they're ordering; it's blocked mid-delivery.
     */
    public AuthResponse switchRole(String userId, UserRole target) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        if (target != UserRole.CUSTOMER && target != UserRole.DELIVERY_PERSONNEL) {
            throw new RuntimeException("You can only switch between customer and dasher");
        }
        if (!isDasher(user)) {
            throw new RuntimeException("Your dasher application hasn't been approved");
        }

        DeliveryPersonnel dp = deliveryPersonnelRepository.findByUserId(userId)
                .orElseGet(() -> newDasherProfile(userId));
        if (target == UserRole.CUSTOMER && dp.getCurrentOrderId() != null) {
            throw new RuntimeException("Finish your current delivery before switching to customer");
        }
        if (target == UserRole.CUSTOMER) {
            dp.setActive(false);
        }
        dp.setUpdatedAt(java.util.Date.from(Instant.now()));
        deliveryPersonnelRepository.save(dp);

        user.setDasherApproved(true);
        user.setRole(target);
        user.setUpdatedAt(java.util.Date.from(Instant.now()));
        return authResponse(userRepository.save(user));
    }

    /** A blank, offline dasher profile (Module 3 needs a record to toggle). */
    public static DeliveryPersonnel newDasherProfile(String userId) {
        return DeliveryPersonnel.builder()
                .userId(userId)
                .isActive(false)
                .totalDeliveries(0)
                .incentiveActive(false)
                .createdAt(java.util.Date.from(Instant.now()))
                .updatedAt(java.util.Date.from(Instant.now()))
                .build();
    }

    private AuthResponse authResponse(User user) {
        return AuthResponse.builder()
                .token(jwtService.generateToken(user))
                .userId(user.getId())
                .fullName(user.getFullName())
                .role(user.getRole())
                .verificationStatus(user.getVerificationStatus())
                .dasherApproved(isDasher(user))
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