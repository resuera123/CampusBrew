package com.campusbrew.campusbrew_api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
@AllArgsConstructor
public class EarningsTotalDTO {
    private double totalEarnings;
    private int totalDeliveries;
    private boolean incentiveActive;
}
