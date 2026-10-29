package com.campusbrew.campusbrew_api.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** v2.0 FR-5.5 — one menu item's units sold in the selected range. */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ItemSalesDTO {
    private String itemId;
    private String name;
    private String category;
    private int unitsSold;

    @JsonProperty("isAvailable")
    private boolean isAvailable;
}
