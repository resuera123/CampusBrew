package com.campusbrew.campusbrew_api.dto;

import com.campusbrew.campusbrew_api.model.CustomizationOptions;
import com.campusbrew.campusbrew_api.model.MenuItem;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class MenuItemDTO {
    private String id;
    private String shopId;
    private String name;
    private double price;
    private String description;
    private String category;
    private String image;

    @JsonProperty("isAvailable")
    private boolean isAvailable;
    private String stockStatus;
    private CustomizationOptions customizationOptions;

    public static MenuItemDTO fromMenuItem(MenuItem item) {
        return MenuItemDTO.builder()
                .id(item.getId())
                .shopId(item.getShopId())
                .name(item.getName())
                .price(item.getPrice())
                .description(item.getDescription())
                .category(item.getCategory())
                .image(item.getImage())
                .isAvailable(item.isAvailable())
                .stockStatus(item.getStockStatus())
                .customizationOptions(item.getCustomizationOptions())
                .build();
    }
}
