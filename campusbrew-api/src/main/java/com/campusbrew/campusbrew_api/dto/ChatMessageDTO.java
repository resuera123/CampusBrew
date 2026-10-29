package com.campusbrew.campusbrew_api.dto;

import com.campusbrew.campusbrew_api.model.ChatChannel;
import com.campusbrew.campusbrew_api.model.ChatMessage;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Date;

/**
 * v2.0 FR-3.5 — a chat message as sent to clients, over REST history and the
 * "chat:message" socket event. {@code clientId} echoes the sender's local id so
 * the sending device can reconcile its optimistic bubble; it is not persisted.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ChatMessageDTO {
    private String id;
    private String clientId;
    private String orderId;
    private ChatChannel channel;
    private String senderId;
    private String senderRole;
    private String text;
    private Date readAt;
    private Date createdAt;

    public static ChatMessageDTO from(ChatMessage m, String clientId) {
        return ChatMessageDTO.builder()
                .id(m.getId())
                .clientId(clientId)
                .orderId(m.getOrderId())
                .channel(m.getChannel())
                .senderId(m.getSenderId())
                .senderRole(m.getSenderRole())
                .text(m.getText())
                .readAt(m.getReadAt())
                .createdAt(m.getCreatedAt())
                .build();
    }
}
