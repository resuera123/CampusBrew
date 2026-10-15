package com.campusbrew.campusbrew_api.push;

import java.util.Map;

/**
 * v2.0 FR-3.4 / NFR-C5 — seam over the Expo Push Service so push logic is testable
 * without live HTTP. {@link HttpExpoPushClient} is the real implementation.
 */
public interface ExpoPushClient {
    void send(String expoPushToken, String title, String body, Map<String, Object> data);
}
