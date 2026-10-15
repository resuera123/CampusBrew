package com.campusbrew.campusbrew_api.push;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * v2.0 FR-3.4 — delivers to the Expo Push Service, which fans out to FCM (Android)
 * and APNs (iOS). The Expo push endpoint is free and needs no server key.
 */
@Slf4j
@Component
public class HttpExpoPushClient implements ExpoPushClient {

    private static final String PUSH_URL = "https://exp.host/--/api/v2/push/send";

    private final RestClient rest = RestClient.builder().baseUrl(PUSH_URL).build();

    @Override
    public void send(String expoPushToken, String title, String body, Map<String, Object> data) {
        Map<String, Object> message = new LinkedHashMap<>();
        message.put("to", expoPushToken);
        message.put("title", title);
        message.put("body", body);
        if (data != null) message.put("data", data);
        message.put("sound", "default");
        message.put("priority", "high");
        try {
            rest.post()
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(message)
                    .retrieve()
                    .toBodilessEntity();
        } catch (Exception e) {
            // Push is best-effort; the in-app socket + foreground refresh are the
            // authoritative paths (NFR-R3). Never let a push failure break a request.
            log.warn("Expo push send failed: {}", e.getMessage());
        }
    }
}
