package com.campusbrew.campusbrew_api.model;

public enum VerificationStatus {
    UNVERIFIED,
    // Passed the CIT-U email code; waiting for an admin to check the student ID.
    PENDING,
    VERIFIED
}
