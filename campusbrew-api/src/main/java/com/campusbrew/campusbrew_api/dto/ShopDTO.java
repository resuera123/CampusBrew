package com.campusbrew.campusbrew_api.dto;

import com.campusbrew.campusbrew_api.model.OperatingHours;
import com.campusbrew.campusbrew_api.model.Shop;
import com.campusbrew.campusbrew_api.service.RatingDisplay;
import com.fasterxml.jackson.annotation.JsonProperty;
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

    // v2.0 FR-2.1 — average from three-way ratings; null until the shop has
    // rating.minCountToShow ratings (the count is always sent).
    private Double ratingAvg;
    private int ratingCount;

    @JsonProperty("isOpen")
    private boolean isOpen;

    private String estimatedPrepTime;

    // False until an admin approves the shop's application (hidden from customers).
    private boolean approved;

    public static ShopDTO fromShop(Shop shop, int ratingMinCountToShow) {
        return ShopDTO.builder()
                .id(shop.getId())
                .shopName(shop.getShopName())
                .description(shop.getDescription())
                .operatingHours(shop.getOperatingHours())
                .location(shop.getLocation())
                .shopImage(shop.getShopImage())
                .ratingAvg(RatingDisplay.visible(shop.getRatingAvg(), shop.getRatingCount(), ratingMinCountToShow))
                .ratingCount(shop.getRatingCount())
                .isOpen(shop.isOpen())
                .estimatedPrepTime(shop.getEstimatedPrepTime())
                .approved(shop.isApprovedShop())
                .build();
    }
}
