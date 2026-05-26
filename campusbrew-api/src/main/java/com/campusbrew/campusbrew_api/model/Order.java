package com.campusbrew.campusbrew_api.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.Date;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Document(collection = "orders")
public class Order {

    @Id
    private String id;

    @Indexed
    private String customerId;

    @Indexed
    private String shopId;

    private String deliveryPersonnelId;

    private List<OrderItem> items;

    private String deliveryLocation;
    /** Free-text notes from the customer to the rider (gate code, building, etc.). */
    private String dasherInstructions;

    private PaymentMethod paymentMethod;
    private PaymentStatus paymentStatus;
    private OrderStatus orderStatus;

    private double beverageSubtotal;
    private double deliveryFee;
    private double platformCommission;
    private double totalAmount;

    private List<StatusHistoryEntry> statusHistory;

    /** When the shop marked the order Ready for Pickup. Drives the 10-min auto-cancel. */
    private Date readyAt;

    private Date createdAt;
    private Date updatedAt;
}
