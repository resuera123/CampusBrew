package com.campusbrew.campusbrew_api.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/** v2.0 FR-5.5 — turn stock tracking on (with a starting count) or off for an item. */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class StockTrackingDTO {
    private boolean enabled;
    /** Starting stock when enabling. */
    private Integer quantity;
    /** Optional; defaults to inventory.lowStockDefault. */
    private Integer lowStockLevel;
}
