package com.campusbrew.campusbrew_api.service;

import com.campusbrew.campusbrew_api.dto.ShopApplicationDTO;
import com.campusbrew.campusbrew_api.dto.ShopApplicationRequest;
import com.campusbrew.campusbrew_api.dto.ShopApprovalStatusDTO;
import com.campusbrew.campusbrew_api.model.ApplicationStatus;
import com.campusbrew.campusbrew_api.model.Shop;
import com.campusbrew.campusbrew_api.model.ShopApplication;
import com.campusbrew.campusbrew_api.model.User;
import com.campusbrew.campusbrew_api.model.UserRole;
import com.campusbrew.campusbrew_api.repository.ShopApplicationRepository;
import com.campusbrew.campusbrew_api.repository.ShopRepository;
import com.campusbrew.campusbrew_api.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Shop approval: a new shop is hidden and can't open until its operator applies
 * (stall name + campus location, operator name + mobile, stall photo, valid ID,
 * shop rules) and an admin approves. Rejection carries a reason; they may reapply.
 * Mirrors DasherApplicationService.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ShopApplicationService {

    private static final Pattern PH_MOBILE = Pattern.compile("^(09|\\+639)\\d{9}$");
    private static final int MAX_PHOTO_CHARS = 2_000_000;

    private final ShopApplicationRepository applicationRepository;
    private final ShopRepository shopRepository;
    private final UserRepository userRepository;
    private final PushNotificationService pushNotificationService;

    public ShopApprovalStatusDTO status(String userId) {
        Shop shop = requireOwnShop(userId);
        ShopApplication latest = latest(userId);
        return ShopApprovalStatusDTO.builder()
                .approved(shop.isApprovedShop())
                .applicationStatus(latest == null ? null : latest.getStatus())
                .rejectionReason(latest == null ? null : latest.getRejectionReason())
                .appliedAt(latest == null ? null : latest.getCreatedAt())
                .build();
    }

    public ShopApprovalStatusDTO apply(String userId, ShopApplicationRequest req) {
        Shop shop = requireOwnShop(userId);
        if (shop.isApprovedShop()) {
            throw new IllegalArgumentException("Your shop is already approved");
        }
        if (applicationRepository.existsByUserIdAndStatus(userId, ApplicationStatus.PENDING)) {
            throw new IllegalArgumentException("Your application is already under review");
        }
        validate(req);

        applicationRepository.save(ShopApplication.builder()
                .userId(userId)
                .shopId(shop.getId())
                .stallName(req.getStallName().trim())
                .location(req.getLocation().trim())
                .operatorName(req.getOperatorName().trim())
                .phoneNumber(req.getPhoneNumber().trim())
                .agreedToRules(true)
                .stallPhoto(req.getStallPhoto())
                .idPhoto(req.getIdPhoto())
                .status(ApplicationStatus.PENDING)
                .createdAt(new Date())
                .build());
        return status(userId);
    }

    // ─── Admin ──────────────────────────────────────────────────

    /** Pending applications oldest first (a queue); null status = everything, newest first. */
    public List<ShopApplicationDTO> list(ApplicationStatus status) {
        List<ShopApplication> apps = status == null
                ? applicationRepository.findAllNewestFirst()
                : applicationRepository.findByStatusOldestFirst(status);
        return apps.stream()
                .map(a -> ShopApplicationDTO.from(a, userRepository.findById(a.getUserId()).orElse(null), false))
                .toList();
    }

    public ShopApplicationDTO get(String id) {
        ShopApplication a = requireApplication(id);
        return ShopApplicationDTO.from(a, userRepository.findById(a.getUserId()).orElse(null), true);
    }

    /** Approves the shop and gives it the stall name and location the admin checked. */
    public ShopApplicationDTO approve(String adminId, String id) {
        ShopApplication a = requirePending(id);
        Shop shop = shopRepository.findById(a.getShopId())
                .orElseThrow(() -> new IllegalArgumentException("Shop not found"));
        shop.setApproved(true);
        shop.setShopName(a.getStallName());
        shop.setLocation(a.getLocation());
        shopRepository.save(shop);

        a.setStatus(ApplicationStatus.APPROVED);
        a.setReviewedBy(adminId);
        a.setReviewedAt(new Date());
        applicationRepository.save(a);
        notify(a.getUserId(), "Your shop is approved!",
                "Customers can now find " + a.getStallName() + ". Open your shop from Edit Shop Profile.");
        return ShopApplicationDTO.from(a, userRepository.findById(a.getUserId()).orElse(null), false);
    }

    public ShopApplicationDTO reject(String adminId, String id, String reason) {
        if (reason == null || reason.isBlank()) {
            throw new IllegalArgumentException("Give the applicant a reason");
        }
        ShopApplication a = requirePending(id);
        a.setStatus(ApplicationStatus.REJECTED);
        a.setRejectionReason(reason.trim());
        a.setReviewedBy(adminId);
        a.setReviewedAt(new Date());
        applicationRepository.save(a);
        notify(a.getUserId(), "Shop application not approved",
                "Reason: " + a.getRejectionReason() + " You can apply again from your dashboard.");
        return ShopApplicationDTO.from(a, userRepository.findById(a.getUserId()).orElse(null), false);
    }

    // ─── Helpers ────────────────────────────────────────────────

    static void validate(ShopApplicationRequest r) {
        if (r == null) throw new IllegalArgumentException("Fill in the application");
        if (blank(r.getStallName())) throw new IllegalArgumentException("Enter your stall or business name");
        if (blank(r.getLocation())) throw new IllegalArgumentException("Enter where your stall is on campus");
        if (blank(r.getOperatorName())) throw new IllegalArgumentException("Enter the operator's full name");
        if (r.getPhoneNumber() == null || !PH_MOBILE.matcher(r.getPhoneNumber().trim()).matches()) {
            throw new IllegalArgumentException("Enter your mobile number as 09XXXXXXXXX");
        }
        if (!r.isAgreedToRules()) {
            throw new IllegalArgumentException("You need to agree to the shop rules");
        }
        photo(r.getStallPhoto(), "your stall");
        photo(r.getIdPhoto(), "a valid ID");
    }

    private static void photo(String dataUri, String what) {
        if (dataUri == null || !dataUri.startsWith("data:image/")) {
            throw new IllegalArgumentException("Add a photo of " + what);
        }
        if (dataUri.length() > MAX_PHOTO_CHARS) {
            throw new IllegalArgumentException("The photo of " + what + " is too large");
        }
    }

    private static boolean blank(String s) {
        return s == null || s.isBlank();
    }

    private ShopApplication latest(String userId) {
        return applicationRepository.findByUserIdNewestFirst(userId).stream().findFirst().orElse(null);
    }

    private void notify(String userId, String title, String body) {
        try {
            pushNotificationService.send(userId, title, body, Map.of("type", "shop-application"));
        } catch (RuntimeException e) {
            log.warn("Shop application push failed for {}: {}", userId, e.getMessage());
        }
    }

    private Shop requireOwnShop(String userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        if (user.getRole() != UserRole.SHOP_OPERATOR) {
            throw new IllegalArgumentException("Only shop operators have a shop to approve");
        }
        return shopRepository.findByOperatorId(userId).stream().findFirst()
                .orElseThrow(() -> new IllegalArgumentException("No shop found for this account"));
    }

    private ShopApplication requirePending(String id) {
        ShopApplication a = requireApplication(id);
        if (a.getStatus() != ApplicationStatus.PENDING) {
            throw new IllegalStateException("This application was already reviewed");
        }
        return a;
    }

    private ShopApplication requireApplication(String id) {
        return applicationRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Application not found"));
    }
}
