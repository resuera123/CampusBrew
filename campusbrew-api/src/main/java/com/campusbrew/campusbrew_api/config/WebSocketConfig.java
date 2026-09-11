package com.campusbrew.campusbrew_api.config;

import com.campusbrew.campusbrew_api.service.JwtService;
import com.campusbrew.campusbrew_api.websocket.JwtHandshakeInterceptor;
import com.campusbrew.campusbrew_api.websocket.RealtimeSocketHandler;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketConfigurer {

    private final RealtimeSocketHandler handler;
    private final JwtService jwtService;

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        // Served on the app's own HTTP port, so a single public port covers
        // both the REST API and realtime traffic.
        registry.addHandler(handler, "/ws")
                .addInterceptors(new JwtHandshakeInterceptor(jwtService))
                .setAllowedOriginPatterns("*");
    }
}
