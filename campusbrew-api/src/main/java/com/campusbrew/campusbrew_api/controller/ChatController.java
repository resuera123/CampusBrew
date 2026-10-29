package com.campusbrew.campusbrew_api.controller;

import com.campusbrew.campusbrew_api.model.ChatChannel;
import com.campusbrew.campusbrew_api.service.ChatService;
import com.campusbrew.campusbrew_api.service.JwtService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * v2.0 FR-3.5 — chat history and reporting. Messages themselves are sent over the
 * socket ("chat:send", see ChatService). Lives under /api/orders/** so it is
 * permitted in SecurityConfig; the JWT is validated here like the other controllers.
 */
@RestController
@RequestMapping("/api/orders/{orderId}/chat/{channel}")
@RequiredArgsConstructor
public class ChatController {

    private final ChatService chatService;
    private final JwtService jwtService;

    @GetMapping
    public ResponseEntity<?> history(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable String orderId,
            @PathVariable String channel) {
        try {
            return ResponseEntity.ok(chatService.history(userIdFrom(authHeader), orderId, channelOf(channel)));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/report")
    public ResponseEntity<?> report(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable String orderId,
            @PathVariable String channel) {
        try {
            chatService.report(userIdFrom(authHeader), orderId, channelOf(channel));
            return ResponseEntity.ok(Map.of("reported", true));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        }
    }

    private static ChatChannel channelOf(String raw) {
        try {
            return ChatChannel.valueOf(raw.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Unknown chat channel: " + raw);
        }
    }

    private String userIdFrom(String authHeader) {
        return jwtService.extractUserId(authHeader.replace("Bearer ", ""));
    }
}
