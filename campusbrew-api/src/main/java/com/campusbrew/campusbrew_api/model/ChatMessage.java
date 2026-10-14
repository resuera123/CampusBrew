package com.campusbrew.campusbrew_api.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.Date;

/**
 * v2.0 FR-3.5 — a message in an order's SHOP or DASHER channel.
 * Unreported messages are purged by a 30-day TTL; reported ones are kept.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Document(collection = "chatMessages")
public class ChatMessage {

    @Id
    private String id;

    private String orderId;
    private ChatChannel channel;

    private String senderId;
    private String senderRole;
    private String text;

    private Date readAt;
    private boolean reported;

    private Date createdAt;
}
