package com.campusbrew.campusbrew_api.dto;

import com.campusbrew.campusbrew_api.model.OrderItem;
import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class OrderItemDTO {
    private String menuItemId;
    private String itemName;
    private int quantity;
    private String size;
    private String sugarLevel;
    private String temperature;
    private List<String> addOns;
    private double unitPrice;
    private double totalPrice;

    public static OrderItemDTO fromOrderItem(OrderItem item) {
        return OrderItemDTO.builder()
                .menuItemId(item.getMenuItemId())
                .itemName(item.getItemName())
                .quantity(item.getQuantity())
                .size(item.getSize())
                .sugarLevel(item.getSugarLevel())
                .temperature(item.getTemperature())
                .addOns(item.getAddOns())
                .unitPrice(item.getUnitPrice())
                .totalPrice(item.getTotalPrice())
                .build();
    }
}
