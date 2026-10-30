package com.campusbrew.campusbrew_api.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.Date;

/**
 * A user's report for the admin queue: a flagged chat conversation (orderId +
 * channel) or a payment problem (paymentId + note).
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Document(collection = "reports")
public class Report {

    @Id
    private String id;

    private ReportType type;
    private String reporterId;

    private String orderId;
    private ChatChannel channel;   // CHAT only
    private String paymentId;      // PAYMENT only
    private String note;           // PAYMENT only

    private ReportStatus status;
    private String resolvedBy;
    private Date resolvedAt;

    private Date createdAt;
}
