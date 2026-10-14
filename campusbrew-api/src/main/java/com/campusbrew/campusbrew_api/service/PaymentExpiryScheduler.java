package com.campusbrew.campusbrew_api.service;

import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * v2.0 FR-4.1 — sweeps GCash payments that sat PENDING past the window to EXPIRED,
 * so an abandoned checkout never produces an order. Runs every minute.
 */
@Component
@RequiredArgsConstructor
public class PaymentExpiryScheduler {

    private final PaymentService paymentService;

    @Scheduled(fixedDelayString = "60000")
    public void sweep() {
        paymentService.expireStalePending();
    }
}
