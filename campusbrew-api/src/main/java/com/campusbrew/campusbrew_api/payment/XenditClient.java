package com.campusbrew.campusbrew_api.payment;

/**
 * v2.0 FR-4.1 — thin seam over Xendit so the payment flow is testable without
 * live HTTP. {@link HttpXenditClient} is the real implementation; tests use a fake.
 */
public interface XenditClient {

    /** Create a one-time GCash e-wallet charge. referenceId is our Payment id. */
    ChargeResult createGcashCharge(String referenceId, double amount);

    /** Refund a charge (full or partial). */
    void refund(String chargeId, double amount);

    /** Result of creating a charge: the gateway charge id and the hosted checkout URL. */
    record ChargeResult(String chargeId, String checkoutUrl) {}
}
