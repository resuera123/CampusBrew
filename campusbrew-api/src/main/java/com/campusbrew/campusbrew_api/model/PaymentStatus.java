package com.campusbrew.campusbrew_api.model;

public enum PaymentStatus {
    PENDING,
    PAID_GCASH,
    PENDING_COD,
    PAID_COD,
    REFUND_PENDING,
    REFUNDED,
    // v2.0 FR-4.2 — COD amounts collected and confirmed did not match; needs manual review.
    FLAGGED
}
