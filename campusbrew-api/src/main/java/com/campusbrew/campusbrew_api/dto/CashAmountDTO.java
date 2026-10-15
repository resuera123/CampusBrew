package com.campusbrew.campusbrew_api.dto;

import lombok.Data;

// v2.0 FR-4.2 — amount for COD cash-collected / confirm-payment.
@Data
public class CashAmountDTO {
    private Double amount;
}
