package com.campusbrew.campusbrew_api.dto;

import com.campusbrew.campusbrew_api.model.ApplicationStatus;
import com.campusbrew.campusbrew_api.model.User;
import com.campusbrew.campusbrew_api.model.VerificationApplication;
import lombok.Builder;
import lombok.Data;

import java.util.Date;

/** A verification request as the admin sees it. */
@Data
@Builder
public class VerificationApplicationDTO {
    private String id;
    private String ref;
    private String userId;
    private String fullName;
    private String email;
    private String phoneNumber;

    private String schoolEmail;
    private String studentId;

    private ApplicationStatus status;
    private String rejectionReason;
    private boolean reapplied;
    private Date reviewedAt;
    private Date createdAt;

    public static VerificationApplicationDTO from(VerificationApplication a, User u, boolean reapplied) {
        return VerificationApplicationDTO.builder()
                .id(a.getId())
                .ref(a.getRef())
                .userId(a.getUserId())
                .fullName(u == null ? null : u.getFullName())
                .email(u == null ? null : u.getEmail())
                .phoneNumber(u == null ? null : u.getPhoneNumber())
                .schoolEmail(a.getSchoolEmail())
                .studentId(a.getStudentId())
                .status(a.getStatus())
                .rejectionReason(a.getRejectionReason())
                .reapplied(reapplied)
                .reviewedAt(a.getReviewedAt())
                .createdAt(a.getCreatedAt())
                .build();
    }
}
