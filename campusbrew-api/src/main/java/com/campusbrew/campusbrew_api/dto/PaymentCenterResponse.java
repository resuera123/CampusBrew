package com.campusbrew.campusbrew_api.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;
import java.util.Map;

/**
 * v2.0 FR-4.8 — the Payment Center payload: the viewer's role, a few headline totals,
 * and the normalized history list (newest first).
 */
@Data
@Builder
public class PaymentCenterResponse {
    private String role;
    private Map<String, Double> summary;
    private List<PaymentCenterEntryDTO> entries;
}
