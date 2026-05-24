package com.campusbrew.campusbrew_api.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OrderItem {
    private String menuItemId;
    private String itemName;
    private int quantity;
    private String size;
    private String sugarLevel;
    private String temperature;
    private List<String> addOns;
    private double unitPrice;
    private double totalPrice;
}
