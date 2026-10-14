package com.campusbrew.campusbrew_api.payment;

/** v2.0 FR-4.1 — payment processing failed (gateway error, not configured, etc.). */
public class PaymentException extends RuntimeException {
    public PaymentException(String message) { super(message); }
    public PaymentException(String message, Throwable cause) { super(message, cause); }
}
