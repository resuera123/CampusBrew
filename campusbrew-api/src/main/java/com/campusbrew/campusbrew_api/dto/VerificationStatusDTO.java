package com.campusbrew.campusbrew_api.dto;

import com.campusbrew.campusbrew_api.model.ApplicationStatus;
import com.campusbrew.campusbrew_api.model.VerificationStatus;
import lombok.Builder;
import lombok.Data;

import java.util.Date;

/** The customer's verification state, with their last request so a rejected one can be fixed and resent. */
@Data
@Builder
public class VerificationStatusDTO {
    private VerificationStatus verificationStatus;
    private ApplicationStatus applicationStatus;
    private String rejectionReason;
    private String schoolEmail;
    private String studentId;
    private Date appliedAt;
}
