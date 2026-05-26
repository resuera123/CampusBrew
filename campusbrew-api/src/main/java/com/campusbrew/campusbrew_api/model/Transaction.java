package com.campusbrew.campusbrew_api.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.Date;

/**
 * Persisted on successful delivery (Wave D). Module 4 will extend the commission
 * and incentive math; for v1 we just snapshot the relevant amounts from the order
 * so downstream reporting and earnings dashboards have a complete row to read.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Document(collection = "transactions")
public class Transaction {

    @Id
    private String id;

    @Indexed
    private String orderId;

    @Indexed
    private String customerId;

    @Indexed
    private String deliveryPersonnelId;

    @Indexed
    private String shopId;

    private double beverageCost;
    private double deliveryFee;
    private double platformCommission;
    private double dpEarnings;

    private PaymentMethod paymentMethod;
    private String xenditTransactionId;

    private TransactionStatus status;

    private Date createdAt;
}
