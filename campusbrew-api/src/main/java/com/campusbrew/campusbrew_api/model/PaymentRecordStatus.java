package com.campusbrew.campusbrew_api.model;

// v2.0 FR-4.1 — lifecycle of a Xendit-backed payment record (the `payments` collection).
// Distinct from the order-level PaymentStatus.
public enum PaymentRecordStatus {
    PENDING,
    PAID,
    FAILED,
    EXPIRED,
    REFUNDED
}
