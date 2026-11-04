package com.campusbrew.campusbrew_api.dto;

import com.campusbrew.campusbrew_api.model.ReportStatus;
import com.campusbrew.campusbrew_api.model.SupportTicket;
import com.campusbrew.campusbrew_api.model.User;
import lombok.Builder;
import lombok.Data;

import java.util.Date;

/** A support ticket for the admin, with the matching account (if any) and its suspension. */
@Data
@Builder
public class SupportTicketDTO {
    private String id;
    private String ref;
    private String email;
    private String name;
    private String topic;
    private String message;
    private ReportStatus status;
    private Date resolvedAt;
    private Date createdAt;

    private String userId;
    private String accountName;
    private String accountRole;
    private boolean suspended;
    private String suspendedReason;

    public static SupportTicketDTO from(SupportTicket t, User u) {
        return SupportTicketDTO.builder()
                .id(t.getId())
                .ref(t.getRef())
                .email(t.getEmail())
                .name(t.getName())
                .topic(t.getTopic())
                .message(t.getMessage())
                .status(t.getStatus())
                .resolvedAt(t.getResolvedAt())
                .createdAt(t.getCreatedAt())
                .userId(u == null ? null : u.getId())
                .accountName(u == null ? null : u.getFullName())
                .accountRole(u == null || u.getRole() == null ? null : u.getRole().name())
                .suspended(u != null && u.isSuspended())
                .suspendedReason(u == null ? null : u.getSuspendedReason())
                .build();
    }
}
