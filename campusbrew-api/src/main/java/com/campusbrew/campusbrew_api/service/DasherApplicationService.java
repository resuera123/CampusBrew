package com.campusbrew.campusbrew_api.service;

import com.campusbrew.campusbrew_api.dto.DasherApplicationDTO;
import com.campusbrew.campusbrew_api.dto.DasherApplicationRequest;
import com.campusbrew.campusbrew_api.dto.DasherStatusDTO;
import com.campusbrew.campusbrew_api.model.ApplicationStatus;
import com.campusbrew.campusbrew_api.model.DasherApplication;
import com.campusbrew.campusbrew_api.model.User;
import com.campusbrew.campusbrew_api.model.UserRole;
import com.campusbrew.campusbrew_api.model.VerificationStatus;
import com.campusbrew.campusbrew_api.repository.DasherApplicationRepository;
import com.campusbrew.campusbrew_api.repository.DeliveryPersonnelRepository;
import com.campusbrew.campusbrew_api.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Become a Dasher: a verified customer applies with contact details, ID + selfie
 * + COR photos and the code-of-conduct agreement; an admin approves or rejects
 * (with a reason, after which they may reapply).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DasherApplicationService {

    /** Philippine mobile: 09XXXXXXXXX or +639XXXXXXXXX. */
    private static final Pattern PH_MOBILE = Pattern.compile("^(09|\\+639)\\d{9}$");
    /** ~1.5 MB of base64 per photo; the app sends ~1024 px JPEGs well under this. */
    private static final int MAX_PHOTO_CHARS = 2_000_000;

    private final DasherApplicationRepository applicationRepository;
    private final UserRepository userRepository;
    private final DeliveryPersonnelRepository deliveryPersonnelRepository;
    private final PushNotificationService pushNotificationService;

    public DasherStatusDTO status(String userId) {
        User user = requireUser(userId);
        DasherApplication latest = applicationRepository.findByUserIdNewestFirst(userId).stream()
                .findFirst().orElse(null);
        return DasherStatusDTO.builder()
                .verified(user.getVerificationStatus() == VerificationStatus.VERIFIED)
                .dasherApproved(AuthService.isDasher(user))
                .applicationStatus(latest == null ? null : latest.getStatus())
                .rejectionReason(latest == null ? null : latest.getRejectionReason())
                .appliedAt(latest == null ? null : latest.getCreatedAt())
                .build();
    }

    public DasherStatusDTO apply(String userId, DasherApplicationRequest req) {
        User user = requireUser(userId);
        if (user.getRole() != UserRole.CUSTOMER) {
            throw new IllegalArgumentException("Only customers can apply to be a dasher");
        }
        if (user.getVerificationStatus() != VerificationStatus.VERIFIED) {
            throw new IllegalArgumentException("Verify your CIT-U account before applying");
        }
        if (AuthService.isDasher(user)) {
            throw new IllegalArgumentException("You're already a dasher");
        }
        if (applicationRepository.existsByUserIdAndStatus(userId, ApplicationStatus.PENDING)) {
            throw new IllegalArgumentException("Your application is already under review");
        }
        validate(req);

        applicationRepository.save(DasherApplication.builder()
                .userId(userId)
                .phoneNumber(req.getPhoneNumber().trim())
                .reason(req.getReason().trim())
                .course(req.getCourse().trim())
                .yearLevel(req.getYearLevel())
                .emergencyName(req.getEmergencyName().trim())
                .emergencyRelationship(req.getEmergencyRelationship().trim())
                .emergencyPhone(req.getEmergencyPhone().trim())
                .agreedToRules(true)
                .idPhoto(req.getIdPhoto())
                .selfiePhoto(req.getSelfiePhoto())
                .corPhoto(req.getCorPhoto())
                .status(ApplicationStatus.PENDING)
                .createdAt(new Date())
                .build());
        return status(userId);
    }

    // ─── Admin ──────────────────────────────────────────────────

    /** Pending applications oldest first (a queue); null status = everything, newest first. */
    public List<DasherApplicationDTO> list(ApplicationStatus status) {
        List<DasherApplication> apps = status == null
                ? applicationRepository.findAllNewestFirst()
                : applicationRepository.findByStatusOldestFirst(status);
        return apps.stream()
                .map(a -> DasherApplicationDTO.from(a, userRepository.findById(a.getUserId()).orElse(null), false))
                .toList();
    }

    public DasherApplicationDTO get(String id) {
        DasherApplication a = requireApplication(id);
        return DasherApplicationDTO.from(a, userRepository.findById(a.getUserId()).orElse(null), true);
    }

    public DasherApplicationDTO approve(String adminId, String id) {
        DasherApplication a = requirePending(id);
        User user = requireUser(a.getUserId());
        user.setDasherApproved(true);
        user.setUpdatedAt(new Date());
        userRepository.save(user);
        if (deliveryPersonnelRepository.findByUserId(user.getId()).isEmpty()) {
            deliveryPersonnelRepository.save(AuthService.newDasherProfile(user.getId()));
        }

        a.setStatus(ApplicationStatus.APPROVED);
        a.setReviewedBy(adminId);
        a.setReviewedAt(new Date());
        applicationRepository.save(a);
        notify(user.getId(), "You're a CampusBrew dasher!",
                "Your application was approved. Open your profile and tap Log in as Dasher.");
        return DasherApplicationDTO.from(a, user, false);
    }

    public DasherApplicationDTO reject(String adminId, String id, String reason) {
        if (reason == null || reason.isBlank()) {
            throw new IllegalArgumentException("Give the applicant a reason");
        }
        DasherApplication a = requirePending(id);
        a.setStatus(ApplicationStatus.REJECTED);
        a.setRejectionReason(reason.trim());
        a.setReviewedBy(adminId);
        a.setReviewedAt(new Date());
        applicationRepository.save(a);
        notify(a.getUserId(), "Dasher application not approved",
                "Reason: " + a.getRejectionReason() + " You can apply again from your profile.");
        return DasherApplicationDTO.from(a, userRepository.findById(a.getUserId()).orElse(null), false);
    }

    // ─── Helpers ────────────────────────────────────────────────

    static void validate(DasherApplicationRequest r) {
        if (r == null) throw new IllegalArgumentException("Fill in the application");
        if (!mobile(r.getPhoneNumber())) {
            throw new IllegalArgumentException("Enter your mobile number as 09XXXXXXXXX");
        }
        if (blank(r.getCourse())) throw new IllegalArgumentException("Enter your course");
        if (r.getYearLevel() < 1 || r.getYearLevel() > 5) {
            throw new IllegalArgumentException("Pick your year level");
        }
        int reasonLength = r.getReason() == null ? 0 : r.getReason().trim().length();
        if (reasonLength < 20 || reasonLength > 500) {
            throw new IllegalArgumentException("Tell us why you want to be a dasher (20 to 500 characters)");
        }
        if (blank(r.getEmergencyName()) || blank(r.getEmergencyRelationship())) {
            throw new IllegalArgumentException("Enter your emergency contact's name and relationship");
        }
        if (!mobile(r.getEmergencyPhone())) {
            throw new IllegalArgumentException("Enter your emergency contact's number as 09XXXXXXXXX");
        }
        if (r.getEmergencyPhone().trim().equals(r.getPhoneNumber().trim())) {
            throw new IllegalArgumentException("Your emergency contact needs a different number from yours");
        }
        if (!r.isAgreedToRules()) {
            throw new IllegalArgumentException("You need to agree to the dasher code of conduct");
        }
        photo(r.getIdPhoto(), "your CIT-U ID");
        photo(r.getSelfiePhoto(), "a selfie holding your ID");
        photo(r.getCorPhoto(), "your Certificate of Registration");
    }

    private static void photo(String dataUri, String what) {
        if (dataUri == null || !dataUri.startsWith("data:image/")) {
            throw new IllegalArgumentException("Add a photo of " + what);
        }
        if (dataUri.length() > MAX_PHOTO_CHARS) {
            throw new IllegalArgumentException("The photo of " + what + " is too large");
        }
    }

    private static boolean mobile(String s) {
        return s != null && PH_MOBILE.matcher(s.trim()).matches();
    }

    private static boolean blank(String s) {
        return s == null || s.isBlank();
    }

    private void notify(String userId, String title, String body) {
        try {
            pushNotificationService.send(userId, title, body, Map.of("type", "application"));
        } catch (RuntimeException e) {
            log.warn("Application push failed for {}: {}", userId, e.getMessage());
        }
    }

    private DasherApplication requirePending(String id) {
        DasherApplication a = requireApplication(id);
        if (a.getStatus() != ApplicationStatus.PENDING) {
            throw new IllegalStateException("This application was already reviewed");
        }
        return a;
    }

    private DasherApplication requireApplication(String id) {
        return applicationRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Application not found"));
    }

    private User requireUser(String userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
    }
}
