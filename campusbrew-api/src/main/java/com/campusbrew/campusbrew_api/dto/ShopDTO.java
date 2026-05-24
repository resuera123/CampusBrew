package com.campusbrew.campusbrew_api.dto;

import com.campusbrew.campusbrew_api.model.OperatingHours;
import com.campusbrew.campusbrew_api.model.Shop;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class ShopDTO {
    private String id;
    private String shopName;
    private String description;
    private OperatingHours operatingHours;
    private String location;
    private String shopImage;
    private double rating;
    private boolean isOpen;
    private String estimatedPrepTime;

    public static ShopDTO fromShop(Shop shop) {
        return ShopDTO.builder()
                .id(shop.getId())
                .shopName(shop.getShopName())
                .description(shop.getDescription())
                .operatingHours(shop.getOperatingHours())
                .location(shop.getLocation())
                .shopImage(shop.getShopImage())
                .rating(shop.getRating())
                .isOpen(shop.isOpen())
                .estimatedPrepTime(shop.getEstimatedPrepTime())
                .build();
    }
}
