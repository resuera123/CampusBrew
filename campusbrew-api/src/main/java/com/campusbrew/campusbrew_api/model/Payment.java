package com.campusbrew.campusbrew_api.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.Date;
import java.util.List;

/**
 * v2.0 FR-4.1/4.7/4.8 — a Xendit-backed payment (order checkout or standalone tip).
 * The order is only created once a payment of type ORDER reaches PAID via webhook.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Document(collection = "payments")
public class Payment {

    @Id
    private String id;

    // Null for an order payment made before the order exists (set once created).
    private String orderId;

    @Indexed
    private String userId;

    private PaymentType type;
    private PaymentMethod method;
    private double amount;

    private PaymentRecordStatus status;

    /** Xendit charge id. Unique when present (partial index); absent until the charge is created. */
    private String gatewayChargeId;

    /** Human-facing reference number from the gateway, shown on receipts. */
    private String referenceNo;

    /** Raw webhook events appended for audit/idempotency. */
    private List<Object> webhookEvents;

    // v2.0 FR-4.8 — "Report a Problem" from the Payment Center.
    private boolean reported;
    private String reportNote;

    /**
     * For a type=ORDER GCash payment: the validated-but-unsaved order, materialized
     * into a real Order document only when the payment reaches PAID (FR-4.1). Null
     * for COD and for TIP payments.
     */
    private Order orderDraft;

    private Date createdAt;
}
