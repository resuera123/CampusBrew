package com.campusbrew.campusbrew_api.service;

import com.campusbrew.campusbrew_api.websocket.InboundSocketHandler;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * v2.0 FR-3.5 — client→server "chat:read": the reader has seen a channel, so the
 * other party's messages get read receipts. Logic lives in {@link ChatService}.
 */
@Component
@RequiredArgsConstructor
public class ChatReadHandler implements InboundSocketHandler {

    private final ChatService chatService;

    @Override
    public String event() {
        return "chat:read";
    }

    @Override
    public void handle(String senderId, String senderRole, JsonNode data) {
        chatService.markRead(senderId,
                data.path("orderId").asText(null),
                ChatService.parseChannel(data.path("channel").asText(null)));
    }
}
