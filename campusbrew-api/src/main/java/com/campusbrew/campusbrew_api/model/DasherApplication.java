package com.campusbrew.campusbrew_api.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.Date;

/**
 * A verified customer's request to become a dasher, reviewed by an admin.
 * Photos are downscaled JPEG data URIs (the app resizes them before upload).
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Document(collection = "dasherApplications")
public class DasherApplication {

    @Id
    private String id;

    @Indexed
    private String userId;

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
    private String reviewedBy;
    private Date reviewedAt;

    private Date createdAt;
}
