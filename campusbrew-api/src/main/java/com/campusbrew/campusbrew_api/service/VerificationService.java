package com.campusbrew.campusbrew_api.service;

import com.campusbrew.campusbrew_api.model.Otp;
import com.campusbrew.campusbrew_api.model.OtpType;
import com.campusbrew.campusbrew_api.model.User;
import com.campusbrew.campusbrew_api.model.VerificationStatus;
import com.campusbrew.campusbrew_api.repository.OtpRepository;
import com.campusbrew.campusbrew_api.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.Date;

@Service
@RequiredArgsConstructor
public class VerificationService {

    private final UserRepository userRepository;
    private final OtpRepository otpRepository;
    private final EmailService emailService;

    /**
     * Send OTP to the user's CIT-U school email.
     * Validates @cit.edu domain and checks for duplicate school email.
     */
    public void sendSchoolOtp(String userId, String schoolEmail) {
        // Validate domain
        if (!schoolEmail.toLowerCase().endsWith("@cit.edu")) {
            throw new RuntimeException("Only @cit.edu email addresses are accepted");
        }

        // Check if school email is already used by another user
        if (userRepository.existsBySchoolEmail(schoolEmail)) {
            User existingUser = userRepository.findByEmail(schoolEmail).orElse(null);
            // Allow re-verification by the same user
            if (existingUser != null && !existingUser.getId().equals(userId)) {
                throw new RuntimeException("This school email is already verified by another account");
            }
        }

        // Clean up previous verification OTPs
        otpRepository.deleteByEmailAndType(schoolEmail, OtpType.VERIFICATION);

        // Generate and send OTP
        String code = String.format("%06d", new SecureRandom().nextInt(999999));
        Otp otp = Otp.builder()
                .email(schoolEmail)
                .code(code)
                .type(OtpType.VERIFICATION)
                .expiresAt(Instant.now().plusSeconds(300))
                .createdAt(Instant.now())
                .build();
        otpRepository.save(otp);

        emailService.sendVerificationEmail(schoolEmail, code);
    }

    /**
     * Verify the OTP and student ID. Updates user to VERIFIED status.
     * Per SDD: validates @cit.edu domain, OTP, student ID format (XX-XXXX-XXX),
     * checks for duplicate school email/student ID.
     */
    public void verify(String userId, String schoolEmail, String otp, String studentId) {
        // Validate school email domain
        if (!schoolEmail.toLowerCase().endsWith("@cit.edu")) {
            throw new RuntimeException("Only @cit.edu email addresses are accepted");
        }

        // Validate student ID format: XX-XXXX-XXX (e.g., 23-1234-567)
        if (!studentId.matches("\\d{2}-\\d{4}-\\d{3}")) {
            throw new RuntimeException("Invalid student ID format. Expected: XX-XXXX-XXX (e.g., 23-1234-567)");
        }

        // Verify OTP
        Otp otpRecord = otpRepository
                .findByEmailAndTypeOrderByCreatedAtDesc(schoolEmail, OtpType.VERIFICATION)
                .orElseThrow(() -> new RuntimeException("Verification code not found. Please request a new one."));

        if (otpRecord.getExpiresAt().isBefore(Instant.now())) {
            throw new RuntimeException("Verification code has expired. Please request a new one.");
        }

        if (!otpRecord.getCode().equals(otp)) {
            throw new RuntimeException("Invalid verification code");
        }

        // Check for duplicate student ID
        if (userRepository.existsByStudentId(studentId)) {
            throw new RuntimeException("This student ID is already verified by another account");
        }

        // Update user to VERIFIED
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        user.setSchoolEmail(schoolEmail.toLowerCase());
        user.setStudentId(studentId);
        user.setVerificationStatus(VerificationStatus.VERIFIED);
        user.setUpdatedAt(Date.from(Instant.now()));
        userRepository.save(user);

        // Clean up used OTP
        otpRepository.deleteByEmailAndType(schoolEmail, OtpType.VERIFICATION);
    }
}
