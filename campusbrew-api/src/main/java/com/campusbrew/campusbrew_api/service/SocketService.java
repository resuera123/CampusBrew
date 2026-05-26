package com.campusbrew.campusbrew_api.service;

import com.corundumstudio.socketio.SocketIOServer;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * Thin wrapper over the Socket.IO server for emitting events to logical rooms.
 *
 * Room naming convention (per SDD §2 / §3.4):
 *   - user:{userId}  — joined automatically on connect (see SocketIOConfig)
 *   - order:{orderId} — joined by interested parties (customer, shop, assigned driver)
 *
 * Domain-specific helpers (delivery assignment, status updates, etc.) live here so
 * controllers/services don't talk to SocketIOServer directly.
 */
@Service
@RequiredArgsConstructor
public class SocketService {

    private final SocketIOServer server;

    public void emitToUser(String userId, String event, Object payload) {
        server.getRoomOperations("user:" + userId).sendEvent(event, payload);
    }

    public void emitToOrder(String orderId, String event, Object payload) {
        server.getRoomOperations("order:" + orderId).sendEvent(event, payload);
    }
}
