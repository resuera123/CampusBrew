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
 * A customer's CIT-U verification, made after they confirm the code sent to their
 * school email, and reviewed by an admin. The school email and student ID are
 * copied to the user only on approval.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Document(collection = "verificationApplications")
public class VerificationApplication implements Referenced {

    @Id
    private String id;

    private String ref;

    @Indexed
    private String userId;

    private String schoolEmail;
    private String studentId;

    private ApplicationStatus status;
    private String rejectionReason;
    private String reviewedBy;
    private Date reviewedAt;

    private Date createdAt;

    @Override
    public String refPrefix() {
        return "VR";
    }
}
