package com.campusbrew.campusbrew_api.service;

import com.campusbrew.campusbrew_api.model.LocationPing;
import com.campusbrew.campusbrew_api.model.Order;
import com.campusbrew.campusbrew_api.model.OrderStatus;
import com.campusbrew.campusbrew_api.repository.LocationPingRepository;
import com.campusbrew.campusbrew_api.repository.OrderRepository;
import com.campusbrew.campusbrew_api.websocket.InboundSocketHandler;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.mongodb.core.geo.GeoJsonPoint;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * v2.0 FR-3.4 / NFR-S8 — live dasher location relay.
 *
 * Registered automatically (InboundSocketHandler) for the client→server
 * "location:update" event. Accepts a location only from the assigned dasher of an
 * OUT_FOR_DELIVERY order, stores it as a ping (7-day TTL, see MongoIndexInitializer),
 * computes a simple walking ETA, and relays it to that order's customer only.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LocationService implements InboundSocketHandler {

    /** Average on-foot speed used for the ETA estimate. */
    private static final double WALK_SPEED_MPS = 1.2;
    private static final double EARTH_RADIUS_M = 6_371_000.0;

    private final OrderRepository orderRepository;
    private final LocationPingRepository locationPingRepository;
    private final ConfigService configService; // drop-off reference (campus center)
    private final SocketService socketService;

    @Override
    public String event() {
        return "location:update";
    }

    @Override
    public void handle(String senderId, String senderRole, JsonNode data) {
        String orderId = data.path("orderId").asText(null);
        if (orderId == null) return;
        if (!data.hasNonNull("lat") || !data.hasNonNull("lng")) return;
        double lat = data.path("lat").asDouble();
        double lng = data.path("lng").asDouble();

        Order order = orderRepository.findById(orderId).orElse(null);
        // Only the assigned dasher of an in-flight delivery may stream location.
        if (order == null
                || order.getOrderStatus() != OrderStatus.OUT_FOR_DELIVERY
                || !senderId.equals(order.getDeliveryPersonnelId())) {
            return;
        }

        locationPingRepository.save(LocationPing.builder()
                .orderId(orderId)
                .dpId(senderId)
                .point(new GeoJsonPoint(lng, lat))
                .createdAt(Date.from(Instant.now()))
                .build());

        long etaSeconds = Math.round(
                haversine(lat, lng, configService.getCampusLatitude(), configService.getCampusLongitude()) / WALK_SPEED_MPS);

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("orderId", orderId);
        payload.put("lat", lat);
        payload.put("lng", lng);
        payload.put("etaSeconds", etaSeconds);
        // Relay to the customer of this order only.
        socketService.emitToUser(order.getCustomerId(), "location:update", payload);
    }

    private static double haversine(double lat1, double lon1, double lat2, double lon2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
}
