package com.campusbrew.campusbrew_api.payment;

import com.campusbrew.campusbrew_api.service.ConfigService;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Map;

/**
 * v2.0 FR-4.1 — real Xendit e-wallet (GCash) integration.
 *
 * Auth is HTTP Basic with the secret key as the username and an empty password.
 * All development must use Xendit TEST keys (SPMP); live mode is for the UAT field test only.
 */
@Slf4j
@Component
public class HttpXenditClient implements XenditClient {

    private static final String BASE_URL = "https://api.xendit.co";

    private final ConfigService config;
    private final RestClient rest;

    public HttpXenditClient(ConfigService config) {
        this.config = config;
        this.rest = RestClient.builder().baseUrl(BASE_URL).build();
    }

    private String authHeader() {
        String key = config.getXenditSecretKey();
        if (key == null || key.isBlank()) {
            throw new PaymentException(
                    "Xendit is not configured (xendit.secretKey is blank). Set XENDIT_SECRET_KEY "
                    + "to your test secret key to use GCash checkout.");
        }
        // Basic <base64(secretKey + ":")>
        String token = Base64.getEncoder()
                .encodeToString((key + ":").getBytes(StandardCharsets.UTF_8));
        return "Basic " + token;
    }

    @Override
    public ChargeResult createGcashCharge(String referenceId, double amount) {
        Map<String, Object> body = Map.of(
                "reference_id", referenceId,
                "currency", "PHP",
                "amount", amount,
                "checkout_method", "ONE_TIME_PAYMENT",
                "channel_code", "PH_GCASH",
                "channel_properties", Map.of(
                        "success_redirect_url", config.getXenditSuccessUrl(),
                        "failure_redirect_url", config.getXenditFailureUrl()));
        try {
            JsonNode res = rest.post()
                    .uri("/ewallets/charges")
                    .header(HttpHeaders.AUTHORIZATION, authHeader())
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(JsonNode.class);

            if (res == null || res.path("id").asText("").isBlank()) {
                throw new PaymentException("Xendit returned no charge id");
            }
            String chargeId = res.path("id").asText();
            JsonNode actions = res.path("actions");
            // Prefer the mobile checkout URL; fall back to the desktop one.
            String url = firstNonBlank(
                    actions.path("mobile_web_checkout_url").asText(null),
                    actions.path("desktop_web_checkout_url").asText(null),
                    actions.path("mobile_deeplink_checkout_url").asText(null));
            if (url == null) {
                throw new PaymentException("Xendit charge " + chargeId + " has no checkout URL");
            }
            return new ChargeResult(chargeId, url);
        } catch (PaymentException e) {
            throw e;
        } catch (Exception e) {
            log.error("Xendit createGcashCharge failed for ref {}: {}", referenceId, e.getMessage());
            throw new PaymentException("Could not start GCash payment. Please try again.", e);
        }
    }

    /** Xendit's refund API version (POST /v3/refunds requires the header). */
    static final String REFUNDS_API_VERSION = "2024-11-11";

    /**
     * These mean the charge was already refunded (e.g. an earlier attempt went
     * through but its reply was lost), so the order can be marked refunded.
     */
    private static final java.util.Set<String> ALREADY_REFUNDED = java.util.Set.of(
            "DUPLICATE_ERROR", "REFUND_IN_PROGRESS", "REFUND_AMOUNT_EXCEEDED", "MAXIMUM_REFUND_AMOUNT_REACHED");

    /**
     * Full refund of a GCash charge through the unified Refunds API, which takes the
     * e-wallet charge id (ewc_…) as payment_id. The reference is fixed per charge so
     * a retry can never refund twice.
     */
    @Override
    public void refund(String chargeId, double amount) {
        Map<String, Object> body = Map.of(
                "reference_id", "refund-" + chargeId,
                "payment_id", chargeId,
                "amount", amount,
                "reason", "CANCELLATION");
        JsonNode res;
        try {
            res = rest.post()
                    .uri("/v3/refunds")
                    .header(HttpHeaders.AUTHORIZATION, authHeader())
                    .header("api-version", REFUNDS_API_VERSION)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(JsonNode.class);
        } catch (org.springframework.web.client.RestClientResponseException e) {
            String reply = e.getResponseBodyAsString();
            if (ALREADY_REFUNDED.stream().anyMatch(reply::contains)) {
                log.info("Xendit says charge {} is already refunded: {}", chargeId, reply);
                return;
            }
            log.error("Xendit refund failed for charge {}: {} {}", chargeId, e.getStatusCode(), reply);
            throw new PaymentException("Refund could not be processed.", e);
        } catch (Exception e) {
            log.error("Xendit refund failed for charge {}: {}", chargeId, e.getMessage());
            throw new PaymentException("Refund could not be processed.", e);
        }
        String status = res == null ? "" : res.path("status").asText("");
        if ("FAILED".equalsIgnoreCase(status)) {
            log.error("Xendit refund for charge {} FAILED: {}", chargeId, res.path("failure_code").asText(""));
            throw new PaymentException("Refund could not be processed.");
        }
        log.info("Xendit refund for charge {} accepted ({})", chargeId, status);
    }

    private static String firstNonBlank(String... values) {
        for (String v : values) {
            if (v != null && !v.isBlank()) return v;
        }
        return null;
    }
}
