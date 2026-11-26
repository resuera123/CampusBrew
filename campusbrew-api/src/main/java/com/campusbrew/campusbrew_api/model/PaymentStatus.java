package com.campusbrew.campusbrew_api.model;

public enum PaymentStatus {
    PENDING,
    // GCash order placed; the customer pays once a dasher has claimed it (no charge before that).
    AWAITING_PAYMENT,
    PAID_GCASH,
    PENDING_COD,
    PAID_COD,
    REFUND_PENDING,
    REFUNDED,
    // v2.0 FR-4.2 — COD amounts collected and confirmed did not match; needs manual review.
    FLAGGED
}
