package com.campusbrew.campusbrew_api.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Document(collection = "menuItems")
public class MenuItem {

    @Id
    private String id;

    @Indexed
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

    // v2.0 FR-5.5 — optional per-item stock tracking. When stockTracking is false
    // (default, and for all legacy items) stockQty/lowStockLevel are ignored.
    // A null lowStockLevel falls back to ConfigService.inventoryLowStockDefault.
    private boolean stockTracking;
    private Integer stockQty;
    private Integer lowStockLevel;
}
