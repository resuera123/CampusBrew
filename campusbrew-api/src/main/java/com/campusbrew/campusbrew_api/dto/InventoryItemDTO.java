package com.campusbrew.campusbrew_api.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** v2.0 FR-5.5 — one menu item's movement for the shop: units sold in the range and stock. */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InventoryItemDTO {
    private String itemId;
    private String name;
    private String category;
    private int unitsSold;
    private boolean stockTracking;
    /** Null when stock isn't tracked for the item. */
    private Integer stockQty;
    private Integer lowStockLevel;
    /** Tracked and at or below its low-stock level. */
    private boolean lowStock;

    @JsonProperty("isAvailable")
    private boolean isAvailable;
}
