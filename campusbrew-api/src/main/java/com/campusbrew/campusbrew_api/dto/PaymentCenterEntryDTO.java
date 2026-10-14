package com.campusbrew.campusbrew_api.dto;

import lombok.Builder;
import lombok.Data;

import java.util.Date;

/**
 * v2.0 FR-4.8 — one line in the Payment Center, normalized across the payments and
 * transactions collections so the mobile list is uniform regardless of source.
 */
@Data
@Builder
public class PaymentCenterEntryDTO {
    private String id;
    /** PAYMENT (payments doc) | TRANSACTION (delivery txn) | COD_ORDER (unpaid/paid COD order). */
    private String source;
    /** Display kind: ORDER | TIP | DELIVERY | COD_COLLECTION. */
    private String kind;
    private String orderId;
    private String method;     // GCASH | COD
    private String status;     // record/order status as a string
    private double amount;     // the headline amount for the viewer's role
    private String referenceNo;
    private String description;
    private boolean reported;  // only meaningful for PAYMENT source
    private Date createdAt;
}
