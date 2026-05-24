package com.campusbrew.campusbrew_api.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class ReorderItemDTO {
    private String menuItemId;
    private String itemName;
    private String image;
    private int quantity;
    private String size;
    private String sugarLevel;
    private String temperature;
    private List<String> addOns;
    private double currentUnitPrice;
    private double currentTotalPrice;
    private boolean isAvailable;
}
