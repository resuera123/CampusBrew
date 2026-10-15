package com.campusbrew.campusbrew_api.service;

import com.campusbrew.campusbrew_api.model.User;
import com.campusbrew.campusbrew_api.push.ExpoPushClient;
import com.campusbrew.campusbrew_api.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.Map;

/**
 * v2.0 FR-3.4 / NFR-C5 — sends push notifications to a user's device through the
 * Expo Push Service. Best-effort and asynchronous: a missing token or a delivery
 * failure is logged, never thrown — the app re-syncs over the socket and on
 * foreground (NFR-R3).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PushNotificationService {

    private final UserRepository userRepository;
    private final ExpoPushClient expoPushClient;

    @Async
    public void send(String userId, String title, String body, Map<String, Object> data) {
        if (userId == null) return;
        String token = userRepository.findById(userId)
                .map(User::getExpoPushToken)
                .orElse(null);
        if (token == null || token.isBlank()) {
            return; // user has no registered device — rely on in-app updates
        }
        expoPushClient.send(token, title, body, data);
    }
}
