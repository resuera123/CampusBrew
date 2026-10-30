package com.campusbrew.campusbrew_api.dto;

import com.campusbrew.campusbrew_api.model.ChatChannel;
import com.campusbrew.campusbrew_api.model.ReportStatus;
import com.campusbrew.campusbrew_api.model.ReportType;
import lombok.Builder;
import lombok.Data;

import java.util.Date;
import java.util.List;

/** A report in the admin queue; messages/payment/people are filled on the detail view. */
@Data
@Builder
public class ReportDTO {
    private String id;
    private ReportType type;
    private ReportStatus status;
    private Date createdAt;
    private Date resolvedAt;

    private String reporterId;
    private String reporterName;

    private String orderId;
    private ChatChannel channel;
    private String paymentId;
    private String note;

    private List<Message> messages;
    private PaymentInfo payment;
    private List<Person> people;

    @Data
    @Builder
    public static class Message {
        private String senderName;
        private String senderRole;
        private String text;
        private Date createdAt;
    }

    @Data
    @Builder
    public static class PaymentInfo {
        private double amount;
        private String type;
        private String method;
        private String status;
        private String referenceNo;
        private Date createdAt;
    }

    /** Someone involved in the report, with their suspension state for the admin's buttons. */
    @Data
    @Builder
    public static class Person {
        private String userId;
        private String name;
        private String role;
        private boolean reporter;
        private boolean suspended;
    }
}
