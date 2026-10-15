package com.campusbrew.campusbrew_api.service;

import com.campusbrew.campusbrew_api.model.User;
import com.campusbrew.campusbrew_api.push.ExpoPushClient;
import com.campusbrew.campusbrew_api.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;
import java.util.Optional;

import static org.mockito.Mockito.*;

/**
 * v2.0 FR-3.4 — PushNotificationService resolves a user's Expo token and only
 * dispatches when one is present. Delivery itself is the client's concern.
 */
@ExtendWith(MockitoExtension.class)
class PushNotificationServiceTest {

    @Mock UserRepository userRepository;
    @Mock ExpoPushClient expoPushClient;
    @InjectMocks PushNotificationService service;

    @Test
    void sends_whenUserHasToken() {
        User u = new User();
        u.setExpoPushToken("ExponentPushToken[abc123]");
        when(userRepository.findById("u1")).thenReturn(Optional.of(u));

        Map<String, Object> data = Map.of("orderId", "o1", "status", "ASSIGNED");
        service.send("u1", "Rider assigned", "On the way", data);

        verify(expoPushClient).send("ExponentPushToken[abc123]", "Rider assigned", "On the way", data);
    }

    @Test
    void skips_whenTokenMissing() {
        User u = new User();
        u.setExpoPushToken(null);
        when(userRepository.findById("u1")).thenReturn(Optional.of(u));

        service.send("u1", "t", "b", Map.of());

        verifyNoInteractions(expoPushClient);
    }

    @Test
    void skips_whenTokenBlank() {
        User u = new User();
        u.setExpoPushToken("   ");
        when(userRepository.findById("u1")).thenReturn(Optional.of(u));

        service.send("u1", "t", "b", Map.of());

        verifyNoInteractions(expoPushClient);
    }

    @Test
    void skips_whenUserNotFound() {
        when(userRepository.findById("ghost")).thenReturn(Optional.empty());

        service.send("ghost", "t", "b", Map.of());

        verifyNoInteractions(expoPushClient);
    }

    @Test
    void skips_whenUserIdNull() {
        service.send(null, "t", "b", Map.of());

        verifyNoInteractions(expoPushClient);
        verifyNoInteractions(userRepository);
    }
}
