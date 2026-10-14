package com.campusbrew.campusbrew_api.payment;

/** v2.0 FR-4.1 — webhook presented a wrong/absent x-callback-token. Maps to HTTP 403. */
public class InvalidCallbackTokenException extends RuntimeException {
    public InvalidCallbackTokenException(String message) { super(message); }
}
