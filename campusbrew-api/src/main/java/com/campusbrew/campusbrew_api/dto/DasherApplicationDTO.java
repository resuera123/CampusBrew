package com.campusbrew.campusbrew_api.dto;

import com.campusbrew.campusbrew_api.model.ApplicationStatus;
import com.campusbrew.campusbrew_api.model.DasherApplication;
import com.campusbrew.campusbrew_api.model.User;
import com.campusbrew.campusbrew_api.model.VerificationStatus;
import lombok.Builder;
import lombok.Data;

import java.util.Date;

/** An application as the admin sees it; photos only on the detail view. */
@Data
@Builder
public class DasherApplicationDTO {
    private String id;
    private String ref;
    private String userId;
    private String fullName;
    private String email;
    private String schoolEmail;
    private String studentId;
    private VerificationStatus verificationStatus;

    private String phoneNumber;
    private String reason;
    private String course;
    private int yearLevel;
    private String emergencyName;
    private String emergencyRelationship;
    private String emergencyPhone;
    private boolean agreedToRules;

    private String idPhoto;
    private String selfiePhoto;
    private String corPhoto;

    private ApplicationStatus status;
    private String rejectionReason;
    // The applicant was rejected before and sent this one again.
    private boolean reapplied;
    private Date reviewedAt;
    private Date createdAt;

    public static DasherApplicationDTO from(DasherApplication a, User u, boolean withPhotos) {
        return from(a, u, withPhotos, false);
    }

    public static DasherApplicationDTO from(DasherApplication a, User u, boolean withPhotos, boolean reapplied) {
        return DasherApplicationDTO.builder()
                .id(a.getId())
                .ref(a.getRef())
                .userId(a.getUserId())
                .fullName(u == null ? null : u.getFullName())
                .email(u == null ? null : u.getEmail())
                .schoolEmail(u == null ? null : u.getSchoolEmail())
                .studentId(u == null ? null : u.getStudentId())
                .verificationStatus(u == null ? null : u.getVerificationStatus())
                .phoneNumber(a.getPhoneNumber())
                .reason(a.getReason())
                .course(a.getCourse())
                .yearLevel(a.getYearLevel())
                .emergencyName(a.getEmergencyName())
                .emergencyRelationship(a.getEmergencyRelationship())
                .emergencyPhone(a.getEmergencyPhone())
                .agreedToRules(a.isAgreedToRules())
                .idPhoto(withPhotos ? a.getIdPhoto() : null)
                .selfiePhoto(withPhotos ? a.getSelfiePhoto() : null)
                .corPhoto(withPhotos ? a.getCorPhoto() : null)
                .status(a.getStatus())
                .rejectionReason(a.getRejectionReason())
                .reapplied(reapplied)
                .reviewedAt(a.getReviewedAt())
                .createdAt(a.getCreatedAt())
                .build();
    }
}
