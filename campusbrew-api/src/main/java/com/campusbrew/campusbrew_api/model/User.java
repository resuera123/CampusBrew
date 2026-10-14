package com.campusbrew.campusbrew_api.model;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.index.Indexed;

import java.util.Date;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Document(collection = "users")
public class User {

    @Id
    private String id;

    private String fullName;

    @Indexed(unique = true)
    private String email;

    private String passwordHash;

    private UserRole role;

    private VerificationStatus verificationStatus;

    private boolean emailVerified;

    // For CIT-U account verification (unlocks COD)
    private String schoolEmail;
    private String studentId;

    private String phoneNumber;
    private String profilePicture;

    // v2.0 FR-3.6 — rating aggregates (shown only once ratingCount >= rating.minCountToShow).
    private double ratingAvg;
    private int ratingCount;

    // v2.0 FR-3.4 — Expo push token for background notifications.
    private String expoPushToken;

    private Date createdAt;
    private Date updatedAt;
}
 