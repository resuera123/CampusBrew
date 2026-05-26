package com.campusbrew.campusbrew_api.config;

import com.corundumstudio.socketio.SocketIOServer;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class SocketIOLifecycle {

    private final SocketIOServer server;

    @PostConstruct
    public void start() {
        server.start();
        log.info("Socket.IO server started on {}:{}",
                server.getConfiguration().getHostname(),
                server.getConfiguration().getPort());
    }

    @PreDestroy
    public void stop() {
        server.stop();
        log.info("Socket.IO server stopped");
    }
}
