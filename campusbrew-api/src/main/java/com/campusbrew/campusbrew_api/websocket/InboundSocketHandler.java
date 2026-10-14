package com.campusbrew.campusbrew_api.websocket;

import com.fasterxml.jackson.databind.JsonNode;

/**
 * v2.0 — a handler for one inbound client→server socket event (e.g. "chat:send",
 * "location:update").
 *
 * Implement this as a Spring @Component and it is auto-registered with
 * {@link RealtimeSocketHandler}; feature services never touch the transport layer.
 * The sender's identity comes from the authenticated handshake (the JWT), not the
 * payload, so a handler can trust {@code senderId}/{@code senderRole}.
 *
 * Handlers emit their responses via {@code SocketService} / {@code RealtimeSocketHandler.emit};
 * this interface is inbound only. Implementations must not block.
 */
public interface InboundSocketHandler {

    /** The event name this handler consumes, e.g. "chat:send". Must be unique across handlers. */
    String event();

    /**
     * @param senderId   authenticated user id of the sender (from the JWT handshake)
     * @param senderRole authenticated role of the sender
     * @param data       the event's "data" payload ({@code MissingNode} if none was sent)
     */
    void handle(String senderId, String senderRole, JsonNode data);
}
