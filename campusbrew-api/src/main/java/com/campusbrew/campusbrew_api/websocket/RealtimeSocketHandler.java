package com.campusbrew.campusbrew_api.websocket;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Room-based fan-out over plain WebSocket, running on the app's own HTTP port.
 *
 * Replaces the previous netty-socketio server, which bound a second port (9092)
 * that PaaS hosts like Render never route public traffic to.
 *
 * Wire format is a JSON frame in both directions:
 *   server -> client   {"event":"order:statusUpdate","data":{...}}
 *   client -> server   {"event":"join","room":"order:123"}
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class RealtimeSocketHandler extends TextWebSocketHandler {

    private final ObjectMapper objectMapper;

    /** Room name -> the sessions currently in it. */
    private final Map<String, Set<WebSocketSession>> rooms = new ConcurrentHashMap<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        String userId = (String) session.getAttributes().get("userId");
        join(session, "user:" + userId);
        log.debug("Socket connected: userId={} role={}", userId, session.getAttributes().get("role"));
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        try {
            JsonNode node = objectMapper.readTree(message.getPayload());
            String event = node.path("event").asText();
            String room = node.path("room").asText();

            // Only order rooms are joinable on request; user rooms are assigned at connect
            // time from the JWT, so a client can never subscribe to someone else's feed.
            if (room.isBlank() || !room.startsWith("order:")) {
                return;
            }

            if ("join".equals(event)) {
                join(session, room);
            } else if ("leave".equals(event)) {
                leave(session, room);
            }
        } catch (Exception e) {
            log.debug("Ignoring malformed socket message: {}", e.getMessage());
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        rooms.values().forEach(members -> members.remove(session));
        rooms.entrySet().removeIf(entry -> entry.getValue().isEmpty());
        log.debug("Socket disconnected: userId={}", session.getAttributes().get("userId"));
    }

    public void join(WebSocketSession session, String room) {
        rooms.computeIfAbsent(room, r -> ConcurrentHashMap.newKeySet()).add(session);
    }

    public void leave(WebSocketSession session, String room) {
        Set<WebSocketSession> members = rooms.get(room);
        if (members != null) {
            members.remove(session);
        }
    }

    /** Sends one event to every live session in the room. No-op if the room is empty. */
    public void emit(String room, String event, Object payload) {
        Set<WebSocketSession> members = rooms.get(room);
        if (members == null || members.isEmpty()) {
            return;
        }

        String frame;
        try {
            Map<String, Object> envelope = new LinkedHashMap<>();
            envelope.put("event", event);
            envelope.put("data", payload);
            frame = objectMapper.writeValueAsString(envelope);
        } catch (Exception e) {
            log.warn("Could not serialize '{}' payload: {}", event, e.getMessage());
            return;
        }

        for (WebSocketSession session : members) {
            if (!session.isOpen()) {
                members.remove(session);
                continue;
            }
            try {
                // sendMessage is not thread-safe and emits arrive from scheduler
                // threads as well as request threads, so serialize per session.
                synchronized (session) {
                    session.sendMessage(new TextMessage(frame));
                }
            } catch (IOException e) {
                log.debug("Dropping dead session {}: {}", session.getId(), e.getMessage());
                members.remove(session);
            }
        }
    }
}
