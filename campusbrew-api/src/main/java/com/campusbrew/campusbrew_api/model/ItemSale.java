package com.campusbrew.campusbrew_api.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.Date;

/**
 * v2.0 FR-5.5 — units of one menu item sold on one delivered order. The source for
 * sales by item, trends and best sellers. The item name is stored too, so items
 * later removed from the menu still show up in past sales.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Document(collection = "itemSales")
public class ItemSale {

    @Id
    private String id;

    private String shopId;
    private String itemId;
    private String itemName;
    private int qty;
    private String orderId;

    private Date createdAt;
}
