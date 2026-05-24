package com.campusbrew.campusbrew_api.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SizeOption {
    private String label;
    private double priceModifier;
}
