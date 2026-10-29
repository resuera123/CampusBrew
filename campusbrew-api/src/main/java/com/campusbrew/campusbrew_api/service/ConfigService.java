package com.campusbrew.campusbrew_api.service;

import lombok.Getter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * v2.0 — single source of truth for business configuration (SDD v2.0 §1).
 *
 * Every tunable business number is read here from application properties /
 * environment variables, so no service hard-codes fees, limits or thresholds.
 * Inject this and call the getter; never re-read a key with a loose @Value
 * elsewhere.
 */
@Service
@Getter
public class ConfigService {

    // Fees (FR-2.2, FR-4.3)
    @Value("${fees.deliveryFee:15}")
    private double deliveryFee;

    @Value("${fees.commission:5}")
    private double commission;

    // Dasher incentive — deliveries at or above this count waive commission (FR-4.3/4.4/4.5).
    @Value("${incentive.threshold:5}")
    private int incentiveThreshold;

    // Cash-on-delivery ceiling in pesos (FR-2.2, FR-4.2)
    @Value("${cod.limit:300}")
    private double codLimit;

    // Re-broadcast an unclaimed offer to all active dashers after this many seconds (FR-3.2)
    @Value("${delivery.offer.rebroadcastSeconds:60}")
    private int offerRebroadcastSeconds;

    // FR-3.2 — reference point for range filtering when a shop has no coordinates
    // yet (CIT-U campus center). Dasher pickup range is measured from here.
    @Value("${delivery.campus.longitude:123.88112327116433}")
    private double campusLongitude;

    @Value("${delivery.campus.latitude:10.294734124980659}")
    private double campusLatitude;

    // Tipping (FR-4.7)
    @Value("${tip.maxAmount:100}")
    private double tipMaxAmount;

    @Value("${tip.windowHours:24}")
    private int tipWindowHours;

    // Ratings (FR-3.6)
    @Value("${rating.windowHours:24}")
    private int ratingWindowHours;

    @Value("${rating.minCountToShow:3}")
    private int ratingMinCountToShow;

    // Chat goes read-only this many minutes after delivery/cancel (FR-3.5)
    @Value("${chat.readOnlyAfterMinutes:30}")
    private int chatReadOnlyAfterMinutes;

    // Default low-stock alert level for newly stock-tracked items (FR-5.5)
    @Value("${inventory.lowStockDefault:5}")
    private int inventoryLowStockDefault;

    // Xendit (FR-4.1) — secrets injected from the environment; may be blank in dev.
    @Value("${xendit.secretKey:}")
    private String xenditSecretKey;

    @Value("${xendit.callbackToken:}")
    private String xenditCallbackToken;

    @Value("${xendit.successUrl:campusbrew://payment/success}")
    private String xenditSuccessUrl;

    @Value("${xendit.failureUrl:campusbrew://payment/failure}")
    private String xenditFailureUrl;
}
