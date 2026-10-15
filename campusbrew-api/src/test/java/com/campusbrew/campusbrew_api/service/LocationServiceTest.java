package com.campusbrew.campusbrew_api.service;

import com.campusbrew.campusbrew_api.model.LocationPing;
import com.campusbrew.campusbrew_api.model.Order;
import com.campusbrew.campusbrew_api.model.OrderStatus;
import com.campusbrew.campusbrew_api.repository.LocationPingRepository;
import com.campusbrew.campusbrew_api.repository.OrderRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** v2.0 FR-3.4 / NFR-S8 — only the assigned dasher may stream; relayed to that customer only. */
class LocationServiceTest {

    private OrderRepository orderRepo;
    private LocationPingRepository pingRepo;
    private ConfigService config;
    private SocketService socket;
    private LocationService service;
    private final ObjectMapper mapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        orderRepo = mock(OrderRepository.class);
        pingRepo = mock(LocationPingRepository.class);
        config = mock(ConfigService.class);
        socket = mock(SocketService.class);
        when(config.getCampusLatitude()).thenReturn(10.2945);
        when(config.getCampusLongitude()).thenReturn(123.881);
        service = new LocationService(orderRepo, pingRepo, config, socket);
    }

    private JsonNode data(String orderId, Double lat, Double lng) {
        var m = new java.util.HashMap<String, Object>();
        m.put("orderId", orderId);
        if (lat != null) m.put("lat", lat);
        if (lng != null) m.put("lng", lng);
        return mapper.valueToTree(m);
    }

    private Order outForDelivery(String dp, String cust) {
        Order o = Order.builder().id("o1").deliveryPersonnelId(dp).customerId(cust)
                .orderStatus(OrderStatus.OUT_FOR_DELIVERY).build();
        when(orderRepo.findById("o1")).thenReturn(Optional.of(o));
        return o;
    }

    @Test
    void assignedDasherStreamsAndRelaysToCustomer() {
        outForDelivery("d1", "c1");
        service.handle("d1", "DELIVERY_PERSONNEL", data("o1", 10.30, 123.89));

        verify(pingRepo).save(any(LocationPing.class));
        ArgumentCaptor<Map> payload = ArgumentCaptor.forClass(Map.class);
        verify(socket).emitToUser(eq("c1"), eq("location:update"), payload.capture());
        Map<?, ?> p = payload.getValue();
        assertThat(p.get("lat")).isEqualTo(10.30);
        assertThat(p.get("etaSeconds")).isInstanceOf(Long.class);
    }

    @Test
    void nonAssignedDasherIsIgnored() {
        outForDelivery("d1", "c1");
        service.handle("intruder", "DELIVERY_PERSONNEL", data("o1", 10.30, 123.89));
        verify(pingRepo, never()).save(any());
        verify(socket, never()).emitToUser(anyString(), anyString(), any());
    }

    @Test
    void ignoredWhenNotOutForDelivery() {
        Order o = Order.builder().id("o1").deliveryPersonnelId("d1").customerId("c1")
                .orderStatus(OrderStatus.ASSIGNED).build();
        when(orderRepo.findById("o1")).thenReturn(Optional.of(o));
        service.handle("d1", "DELIVERY_PERSONNEL", data("o1", 10.30, 123.89));
        verify(pingRepo, never()).save(any());
        verify(socket, never()).emitToUser(anyString(), anyString(), any());
    }

    @Test
    void missingCoordinatesIgnored() {
        outForDelivery("d1", "c1");
        service.handle("d1", "DELIVERY_PERSONNEL", data("o1", null, null));
        verify(pingRepo, never()).save(any());
    }

    @Test
    void handlesTheLocationUpdateEvent() {
        assertThat(service.event()).isEqualTo("location:update");
    }
}
