package com.campusbrew.campusbrew_api.service;

import com.campusbrew.campusbrew_api.dto.VerificationApplicationDTO;
import com.campusbrew.campusbrew_api.dto.VerificationStatusDTO;
import com.campusbrew.campusbrew_api.model.ApplicationStatus;
import com.campusbrew.campusbrew_api.model.Otp;
import com.campusbrew.campusbrew_api.model.OtpType;
import com.campusbrew.campusbrew_api.model.User;
import com.campusbrew.campusbrew_api.model.VerificationApplication;
import com.campusbrew.campusbrew_api.model.VerificationStatus;
import com.campusbrew.campusbrew_api.repository.OtpRepository;
import com.campusbrew.campusbrew_api.repository.UserRepository;
import com.campusbrew.campusbrew_api.repository.VerificationApplicationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class VerificationService {

    private final UserRepository userRepository;
    private final OtpRepository otpRepository;
    private final EmailService emailService;
    private final VerificationApplicationRepository applicationRepository;
    private final PushNotificationService pushNotificationService;

    /**
     * Send OTP to the user's CIT-U school email.
     * Validates @cit.edu domain and checks for duplicate school email.
     */
    public void sendSchoolOtp(String userId, String schoolEmail) {
        requireNotVerifiedOrPending(requireUser(userId));

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
     * Checks the OTP and student ID, then sends the request to the admin queue. Per SDD:
     * validates @cit.edu domain, OTP, student ID format (XX-XXXX-XXX), and checks for a
     * duplicate student ID. The user is PENDING until an admin approves.
     */
    public VerificationStatusDTO verify(String userId, String schoolEmail, String otp, String studentId) {
        User user = requireUser(userId);
        requireNotVerifiedOrPending(user);

        // Validate school email domain
        if (!schoolEmail.toLowerCase().endsWith("@cit.edu")) {
            throw new RuntimeException("Only @cit.edu email addresses are accepted");
        }

        // Validate student ID format: XX-XXXX-XXX (e.g., 23-1234-567)
        if (studentId == null || !studentId.trim().matches("\\d{2}-\\d{4}-\\d{3}")) {
            throw new RuntimeException("Invalid student ID format. Expected: XX-XXXX-XXX (e.g., 23-1234-567)");
        }
        studentId = studentId.trim();

        // Verify OTP
        Otp otpRecord = otpRepository
                .findFirstByEmailAndTypeOrderByCreatedAtDesc(schoolEmail, OtpType.VERIFICATION)
                .orElseThrow(() -> new RuntimeException("Verification code not found. Please request a new one."));

        if (otpRecord.getExpiresAt().isBefore(Instant.now())) {
            throw new RuntimeException("Verification code has expired. Please request a new one.");
        }

        if (!otpRecord.getCode().equals(otp)) {
            throw new RuntimeException("Invalid verification code");
        }

        requireStudentIdFree(userId, studentId);

        applicationRepository.save(VerificationApplication.builder()
                .userId(userId)
                .schoolEmail(schoolEmail.toLowerCase())
                .studentId(studentId)
                .status(ApplicationStatus.PENDING)
                .createdAt(new Date())
                .build());
        user.setVerificationStatus(VerificationStatus.PENDING);
        user.setUpdatedAt(new Date());
        userRepository.save(user);

        // Clean up used OTP
        otpRepository.deleteByEmailAndType(schoolEmail, OtpType.VERIFICATION);
        return status(userId);
    }

    public VerificationStatusDTO status(String userId) {
        User user = requireUser(userId);
        VerificationApplication latest = applicationRepository.findByUserIdOrderByCreatedAtDesc(userId)
                .stream().findFirst().orElse(null);
        VerificationStatus current = user.getVerificationStatus() == null
                ? VerificationStatus.UNVERIFIED : user.getVerificationStatus();
        return VerificationStatusDTO.builder()
                .verificationStatus(current)
                .applicationStatus(latest == null ? null : latest.getStatus())
                .rejectionReason(latest == null ? null : latest.getRejectionReason())
                .schoolEmail(latest != null ? latest.getSchoolEmail() : user.getSchoolEmail())
                .studentId(latest != null ? latest.getStudentId() : user.getStudentId())
                .appliedAt(latest == null ? null : latest.getCreatedAt())
                .build();
    }

    // ─── Admin ──────────────────────────────────────────────────

    /** Pending requests oldest first (a queue); null status = everything, newest first. */
    public List<VerificationApplicationDTO> list(ApplicationStatus status) {
        List<VerificationApplication> apps = status == null
                ? applicationRepository.findAllByOrderByCreatedAtDesc()
                : applicationRepository.findByStatusOrderByCreatedAtAsc(status);
        return apps.stream().map(this::dto).toList();
    }

    public VerificationApplicationDTO get(String id) {
        return dto(requireApplication(id));
    }

    public VerificationApplicationDTO approve(String adminId, String id) {
        VerificationApplication a = requirePending(id);
        User holder = userRepository.findByStudentId(a.getStudentId()).orElse(null);
        if (holder != null && !holder.getId().equals(a.getUserId())
                && holder.getVerificationStatus() == VerificationStatus.VERIFIED) {
            throw new IllegalArgumentException("This student ID is already verified by another account");
        }
        User user = requireUser(a.getUserId());
        user.setSchoolEmail(a.getSchoolEmail());
        user.setStudentId(a.getStudentId());
        user.setVerificationStatus(VerificationStatus.VERIFIED);
        user.setUpdatedAt(new Date());
        userRepository.save(user);

        a.setStatus(ApplicationStatus.APPROVED);
        a.setReviewedBy(adminId);
        a.setReviewedAt(new Date());
        applicationRepository.save(a);
        notify(user.getId(), "You're verified!",
                "Your CIT-U account is verified. Cash on Delivery and Become a Dasher are now unlocked.");
        return dto(a);
    }

    public VerificationApplicationDTO reject(String adminId, String id, String reason) {
        if (reason == null || reason.isBlank()) {
            throw new IllegalArgumentException("Give the applicant a reason");
        }
        VerificationApplication a = requirePending(id);
        a.setStatus(ApplicationStatus.REJECTED);
        a.setRejectionReason(reason.trim());
        a.setReviewedBy(adminId);
        a.setReviewedAt(new Date());
        applicationRepository.save(a);

        User user = requireUser(a.getUserId());
        if (user.getVerificationStatus() == VerificationStatus.PENDING) {
            user.setVerificationStatus(VerificationStatus.UNVERIFIED);
            user.setUpdatedAt(new Date());
            userRepository.save(user);
        }
        notify(user.getId(), "Verification not approved",
                "Reason: " + a.getRejectionReason() + " You can verify again from your profile.");
        return dto(a);
    }

    // ─── Helpers ────────────────────────────────────────────────

    private static void requireNotVerifiedOrPending(User user) {
        if (user.getVerificationStatus() == VerificationStatus.VERIFIED) {
            throw new RuntimeException("Your account is already verified");
        }
        if (user.getVerificationStatus() == VerificationStatus.PENDING) {
            throw new RuntimeException("Your verification is already under review");
        }
    }

    private void requireStudentIdFree(String userId, String studentId) {
        User holder = userRepository.findByStudentId(studentId).orElse(null);
        if (holder != null && !holder.getId().equals(userId)
                && holder.getVerificationStatus() == VerificationStatus.VERIFIED) {
            throw new RuntimeException("This student ID is already verified by another account");
        }
        if (applicationRepository.existsByStudentIdAndStatusAndUserIdNot(studentId, ApplicationStatus.PENDING, userId)) {
            throw new RuntimeException("This student ID is already waiting for review on another account");
        }
    }

    private VerificationApplicationDTO dto(VerificationApplication a) {
        boolean reapplied = a.getCreatedAt() != null
                && applicationRepository.countByUserIdAndCreatedAtBefore(a.getUserId(), a.getCreatedAt()) > 0;
        return VerificationApplicationDTO.from(a, userRepository.findById(a.getUserId()).orElse(null), reapplied);
    }

    private void notify(String userId, String title, String body) {
        try {
            pushNotificationService.send(userId, title, body, Map.of("type", "verification"));
        } catch (RuntimeException e) {
            log.warn("Verification push failed for {}: {}", userId, e.getMessage());
        }
    }

    private VerificationApplication requirePending(String id) {
        VerificationApplication a = requireApplication(id);
        if (a.getStatus() != ApplicationStatus.PENDING) {
            throw new IllegalStateException("This request was already reviewed");
        }
        return a;
    }

    private VerificationApplication requireApplication(String id) {
        return applicationRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Verification request not found"));
    }

    private User requireUser(String userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
    }
}
