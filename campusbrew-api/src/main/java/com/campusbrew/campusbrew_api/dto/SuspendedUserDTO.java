package com.campusbrew.campusbrew_api.dto;

import com.campusbrew.campusbrew_api.model.User;
import lombok.Builder;
import lombok.Data;

import java.util.Date;

/** A row in the admin's Suspensions list. */
@Data
@Builder
public class SuspendedUserDTO {
    private String userId;
    private String fullName;
    private String email;
    private String role;
    private boolean dasherApproved;
    private String reason;
    private Date suspendedAt;

    public static SuspendedUserDTO from(User u) {
        return SuspendedUserDTO.builder()
                .userId(u.getId())
                .fullName(u.getFullName())
                .email(u.getEmail())
                .role(u.getRole() == null ? null : u.getRole().name())
                .dasherApproved(u.isDasherApproved())
                .reason(u.getSuspendedReason())
                .suspendedAt(u.getSuspendedAt())
                .build();
    }
}
