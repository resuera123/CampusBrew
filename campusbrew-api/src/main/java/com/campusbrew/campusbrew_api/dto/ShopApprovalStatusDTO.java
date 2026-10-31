package com.campusbrew.campusbrew_api.dto;

import com.campusbrew.campusbrew_api.model.ApplicationStatus;
import lombok.Builder;
import lombok.Data;

import java.util.Date;

/** What the shop dashboard needs to show the "not live yet" banner. */
@Data
@Builder
public class ShopApprovalStatusDTO {
    private boolean approved;
    /** Latest application, or null if they never applied. */
    private ApplicationStatus applicationStatus;
    private String rejectionReason;
    private Date appliedAt;
}
