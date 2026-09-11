package com.campusbrew.campusbrew_api.service;

import com.campusbrew.campusbrew_api.websocket.RealtimeSocketHandler;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * Thin wrapper over the realtime WebSocket handler for emitting events to logical rooms.
 *
 * Room naming convention (per SDD §2 / §3.4):
 *   - user:{userId}  — joined automatically on connect (see RealtimeSocketHandler)
 *   - order:{orderId} — joined by interested parties (customer, shop, assigned driver)
 *
 * Domain-specific helpers (delivery assignment, status updates, etc.) live here so
 * controllers/services don't talk to the socket handler directly.
 */
@Service
@RequiredArgsConstructor
public class SocketService {

    private final RealtimeSocketHandler handler;

    public void emitToUser(String userId, String event, Object payload) {
        handler.emit("user:" + userId, event, payload);
    }

    public void emitToOrder(String orderId, String event, Object payload) {
        handler.emit("order:" + orderId, event, payload);
    }
}
