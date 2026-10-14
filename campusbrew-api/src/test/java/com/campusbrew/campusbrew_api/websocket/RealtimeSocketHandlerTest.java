package com.campusbrew.campusbrew_api.websocket;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class RealtimeSocketHandlerTest {

    private RealtimeSocketHandler handler;

    @BeforeEach
    void setUp() {
        handler = new RealtimeSocketHandler(new ObjectMapper(), List.of());
    }

    private WebSocketSession session(String userId) throws Exception {
        WebSocketSession session = mock(WebSocketSession.class);
        Map<String, Object> attributes = new HashMap<>();
        attributes.put("userId", userId);
        attributes.put("role", "CUSTOMER");
        when(session.getAttributes()).thenReturn(attributes);
        when(session.isOpen()).thenReturn(true);
        when(session.getId()).thenReturn("sess-" + userId);
        return session;
    }

    private String sentFrame(WebSocketSession session) throws Exception {
        var captor = org.mockito.ArgumentCaptor.forClass(TextMessage.class);
        verify(session).sendMessage(captor.capture());
        return captor.getValue().getPayload();
    }

    @Test
    void connectingJoinsTheUsersOwnRoom() throws Exception {
        WebSocketSession alice = session("alice");
        handler.afterConnectionEstablished(alice);

        handler.emit("user:alice", "order:statusUpdate", Map.of("orderId", "o1"));

        assertThat(sentFrame(alice))
                .contains("\"event\":\"order:statusUpdate\"")
                .contains("\"orderId\":\"o1\"");
    }

    @Test
    void eventsDoNotLeakBetweenUsers() throws Exception {
        WebSocketSession alice = session("alice");
        WebSocketSession bob = session("bob");
        handler.afterConnectionEstablished(alice);
        handler.afterConnectionEstablished(bob);

        handler.emit("user:alice", "delivery:request", Map.of("orderId", "o1"));

        verify(alice).sendMessage(any(TextMessage.class));
        verify(bob, never()).sendMessage(any(TextMessage.class));
    }

    @Test
    void clientsCanJoinAndLeaveOrderRooms() throws Exception {
        WebSocketSession alice = session("alice");
        handler.afterConnectionEstablished(alice);

        handler.handleTextMessage(alice, new TextMessage("{\"event\":\"join\",\"room\":\"order:o1\"}"));
        handler.emit("order:o1", "order:statusUpdate", Map.of("status", "READY"));
        verify(alice).sendMessage(any(TextMessage.class));

        handler.handleTextMessage(alice, new TextMessage("{\"event\":\"leave\",\"room\":\"order:o1\"}"));
        handler.emit("order:o1", "order:statusUpdate", Map.of("status", "DELIVERED"));
        // Still just the one send from before the leave.
        verify(alice, times(1)).sendMessage(any(TextMessage.class));
    }

    @Test
    void clientsCannotSubscribeToAnotherUsersRoom() throws Exception {
        WebSocketSession mallory = session("mallory");
        handler.afterConnectionEstablished(mallory);

        handler.handleTextMessage(mallory, new TextMessage("{\"event\":\"join\",\"room\":\"user:alice\"}"));
        handler.emit("user:alice", "order:statusUpdate", Map.of("orderId", "o1"));

        verify(mallory, never()).sendMessage(any(TextMessage.class));
    }

    @Test
    void disconnectRemovesTheSessionFromItsRooms() throws Exception {
        WebSocketSession alice = session("alice");
        handler.afterConnectionEstablished(alice);
        handler.afterConnectionClosed(alice, CloseStatus.NORMAL);

        handler.emit("user:alice", "order:statusUpdate", Map.of("orderId", "o1"));

        verify(alice, never()).sendMessage(any(TextMessage.class));
    }

    @Test
    void malformedFramesAreIgnored() throws Exception {
        WebSocketSession alice = session("alice");
        handler.afterConnectionEstablished(alice);

        handler.handleTextMessage(alice, new TextMessage("not json at all"));

        handler.emit("user:alice", "ping", Map.of("ok", true));
        verify(alice).sendMessage(any(TextMessage.class));
    }

    // ---- v2.0 inbound domain-event dispatch ----

    /** Records what it was dispatched, for assertions. */
    static class RecordingHandler implements InboundSocketHandler {
        final String event;
        final List<String> calls = new ArrayList<>();
        RecordingHandler(String event) { this.event = event; }
        public String event() { return event; }
        public void handle(String senderId, String senderRole, JsonNode data) {
            calls.add(senderId + "|" + senderRole + "|" + data.path("text").asText());
        }
    }

    @Test
    void domainEventsDispatchToTheirHandlerWithAuthenticatedIdentity() throws Exception {
        RecordingHandler chat = new RecordingHandler("chat:send");
        RealtimeSocketHandler h = new RealtimeSocketHandler(new ObjectMapper(), List.of(chat));

        WebSocketSession alice = session("alice");
        h.afterConnectionEstablished(alice);
        h.handleTextMessage(alice, new TextMessage(
                "{\"event\":\"chat:send\",\"data\":{\"orderId\":\"o1\",\"text\":\"hi\"}}"));

        // Identity comes from the session (JWT), not the payload.
        assertThat(chat.calls).containsExactly("alice|CUSTOMER|hi");
    }

    @Test
    void unknownDomainEventsAreIgnored() throws Exception {
        RecordingHandler chat = new RecordingHandler("chat:send");
        RealtimeSocketHandler h = new RealtimeSocketHandler(new ObjectMapper(), List.of(chat));

        WebSocketSession alice = session("alice");
        h.afterConnectionEstablished(alice);
        h.handleTextMessage(alice, new TextMessage(
                "{\"event\":\"nonsense:event\",\"data\":{\"text\":\"x\"}}"));

        assertThat(chat.calls).isEmpty();
    }

    @Test
    void joinStillWorksAlongsideRegisteredHandlers() throws Exception {
        RecordingHandler chat = new RecordingHandler("chat:send");
        RealtimeSocketHandler h = new RealtimeSocketHandler(new ObjectMapper(), List.of(chat));

        WebSocketSession alice = session("alice");
        h.afterConnectionEstablished(alice);
        h.handleTextMessage(alice, new TextMessage("{\"event\":\"join\",\"room\":\"order:o1\"}"));
        h.emit("order:o1", "order:statusUpdate", Map.of("status", "READY"));

        verify(alice).sendMessage(any(TextMessage.class));
        assertThat(chat.calls).isEmpty();
    }
}
