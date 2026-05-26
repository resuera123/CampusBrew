package com.campusbrew.campusbrew_api.config;

import com.campusbrew.campusbrew_api.service.JwtService;
import com.corundumstudio.socketio.AuthorizationResult;
import com.corundumstudio.socketio.SocketIOServer;
import io.jsonwebtoken.Claims;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Slf4j
@Configuration
public class SocketIOConfig {

    @Value("${socketio.host:0.0.0.0}")
    private String host;

    @Value("${socketio.port:9092}")
    private int port;

    @Bean
    public SocketIOServer socketIOServer(JwtService jwtService) {
        com.corundumstudio.socketio.Configuration config = new com.corundumstudio.socketio.Configuration();
        config.setHostname(host);
        config.setPort(port);
        config.setOrigin("*");

        // Reject the handshake outright if the JWT is missing or invalid.
        // We re-validate in the ConnectListener so we can stash claims on the client session.
        config.setAuthorizationListener(handshakeData -> {
            String token = handshakeData.getSingleUrlParam("token");
            if (token == null || token.isBlank()) {
                log.debug("Socket handshake rejected: missing token");
                return AuthorizationResult.FAILED_AUTHORIZATION;
            }
            try {
                jwtService.validateToken(token);
                return AuthorizationResult.SUCCESSFUL_AUTHORIZATION;
            } catch (Exception e) {
                log.debug("Socket handshake rejected: invalid token ({})", e.getMessage());
                return AuthorizationResult.FAILED_AUTHORIZATION;
            }
        });

        SocketIOServer server = new SocketIOServer(config);

        server.addConnectListener(client -> {
            try {
                String token = client.getHandshakeData().getSingleUrlParam("token");
                Claims claims = jwtService.validateToken(token);
                String userId = claims.getSubject();
                String role = claims.get("role", String.class);

                client.set("userId", userId);
                client.set("role", role);
                client.joinRoom("user:" + userId);

                log.debug("Socket connected: userId={} role={}", userId, role);
            } catch (Exception e) {
                log.warn("Socket connect failed during session setup: {}", e.getMessage());
                client.disconnect();
            }
        });

        server.addDisconnectListener(client -> {
            String userId = client.get("userId");
            log.debug("Socket disconnected: userId={}", userId);
        });

        return server;
    }
}
