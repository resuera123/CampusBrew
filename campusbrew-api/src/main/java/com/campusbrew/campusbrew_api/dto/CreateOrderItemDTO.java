package com.campusbrew.campusbrew_api.dto;

import lombok.Data;

import java.util.List;

@Data
public class CreateOrderItemDTO {
    private String menuItemId;
    private int quantity;
    private String size;
    private String sugarLevel;
    private String temperature;
    private List<String> addOns;
    private String optionsHash; // v2.0 FR-2.2 — client-supplied; server recomputes defensively
}
