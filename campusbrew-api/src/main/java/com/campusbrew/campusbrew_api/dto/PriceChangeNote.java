package com.campusbrew.campusbrew_api.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PriceChangeNote {
    private String itemName;
    private double previousPrice;
    private double currentPrice;
}
