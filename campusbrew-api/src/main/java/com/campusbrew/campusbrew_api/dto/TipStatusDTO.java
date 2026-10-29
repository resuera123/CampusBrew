package com.campusbrew.campusbrew_api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Date;
import java.util.List;

/** v2.0 FR-4.7 — whether the customer can still tip a delivered order, and what they've tipped. */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TipStatusDTO {
    private String orderId;
    private boolean canTip;
    /** Why tipping is unavailable; null while canTip. */
    private String reason;
    private Date closesAt;
    private double maxAmount;
    private List<Integer> presets;
    private String dasherName;
    /** Tip paid with the order at checkout. */
    private double checkoutTip;
    /** Tip paid by GCash after delivery (0 if none). */
    private double postDeliveryTip;
}
