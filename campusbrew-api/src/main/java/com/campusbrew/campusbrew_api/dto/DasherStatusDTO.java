package com.campusbrew.campusbrew_api.dto;

import com.campusbrew.campusbrew_api.model.ApplicationStatus;
import lombok.Builder;
import lombok.Data;

import java.util.Date;

/** What the customer's profile needs to draw the Become a Dasher / Log in as Dasher button. */
@Data
@Builder
public class DasherStatusDTO {
    private boolean verified;
    private boolean dasherApproved;
    /** Latest application, or null if they never applied. */
    private ApplicationStatus applicationStatus;
    private String rejectionReason;
    private Date appliedAt;
}
