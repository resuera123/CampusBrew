package com.campusbrew.campusbrew_api.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.Date;

/**
 * v2.0 FR-5.5 — an append-only stock ledger entry for a menu item.
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
    private int balanceAfter;

    /** Set for SALE movements. */
    private String orderId;

    private Date createdAt;
}
