package com.campusbrew.campusbrew_api.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.Date;

/**
 * v2.0 FR-5.5 — an append-only stock ledger entry for a menu item. A SALE is written
 * for every item on a delivered order (tracked or not), so it is also the source of
 * units-sold figures and trends.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Document(collection = "inventoryMovements")
public class InventoryMovement {

    @Id
    private String id;

    private String shopId;
    private String itemId;

    private InventoryMovementType type;
    private int qty;
    /** Stock after this movement; null for an item without stock tracking. */
    private Integer balanceAfter;

    /** Set for SALE movements. */
    private String orderId;

    private Date createdAt;
}
