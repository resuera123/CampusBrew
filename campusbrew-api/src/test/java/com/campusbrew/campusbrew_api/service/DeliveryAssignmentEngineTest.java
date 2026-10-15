package com.campusbrew.campusbrew_api.service;

import com.campusbrew.campusbrew_api.model.*;
import com.campusbrew.campusbrew_api.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.geo.GeoJsonPoint;
import org.springframework.data.mongodb.core.query.Query;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** v2.0 FR-3.2 — range-filtered broadcast offers and 60s re-broadcast. */
class DeliveryAssignmentEngineTest {

    // Campus center used by the engine (from ConfigService).
    private static final double LNG = 123.881, LAT = 10.2945;

    private MongoTemplate mongo;
    private DeliveryAssignmentRepository assignmentRepo;
    private DeliveryPersonnelRepository dpRepo;
    private OrderRepository orderRepo;
    private ShopRepository shopRepo;
    private UserRepository userRepo;
    private SocketService socket;
    private ConfigService config;
    private DeliveryAssignmentEngine engine;

    @BeforeEach
    void setUp() {
        mongo = mock(MongoTemplate.class);
        assignmentRepo = mock(DeliveryAssignmentRepository.class);
        dpRepo = mock(DeliveryPersonnelRepository.class);
        orderRepo = mock(OrderRepository.class);
        shopRepo = mock(ShopRepository.class);
        userRepo = mock(UserRepository.class);
        socket = mock(SocketService.class);
        config = mock(ConfigService.class);

        when(config.getCampusLongitude()).thenReturn(LNG);
        when(config.getCampusLatitude()).thenReturn(LAT);
        when(config.getOfferRebroadcastSeconds()).thenReturn(60);
        when(config.getIncentiveThreshold()).thenReturn(5);
        when(config.getRatingMinCountToShow()).thenReturn(3);

        when(shopRepo.findById("shop1")).thenReturn(Optional.of(
                Shop.builder().id("shop1").shopName("Brew").location("CIT-U").operatorId("op1").build()));
        when(assignmentRepo.findByOrderId(anyString())).thenReturn(new ArrayList<>());

        engine = new DeliveryAssignmentEngine(mongo, assignmentRepo, dpRepo, orderRepo,
                shopRepo, userRepo, socket, config, mock(PushNotificationService.class));
    }

    private DeliveryPersonnel dp(String id, GeoJsonPoint loc, Integer range) {
        return DeliveryPersonnel.builder().userId(id).isActive(true)
                .currentLocation(loc).pickupRangeMeters(range).totalDeliveries(0).build();
    }

    private Order readyOrder() {
        return Order.builder().id("o1").customerId("cust1").shopId("shop1")
                .items(new ArrayList<>()).deliveryLocation("GLE Lobby")
                .paymentMethod(PaymentMethod.COD).orderStatus(OrderStatus.READY_FOR_PICKUP)
                .beverageSubtotal(89).deliveryFee(15).platformCommission(5).tip(10).totalAmount(114)
                .build();
    }

    private void activeDps(DeliveryPersonnel... dps) {
        when(mongo.find(any(Query.class), eq(DeliveryPersonnel.class))).thenReturn(List.of(dps));
    }

    private List<String> offeredTo() {
        ArgumentCaptor<String> who = ArgumentCaptor.forClass(String.class);
        verify(socket, atLeast(0)).emitToUser(who.capture(), eq("delivery:request"), any());
        return who.getAllValues();
    }

    @Test
    void initialBroadcastFiltersByRange() {
        DeliveryPersonnel inRange = dp("in", new GeoJsonPoint(LNG, LAT), 1000);        // ~0m
        DeliveryPersonnel outRange = dp("out", new GeoJsonPoint(LNG + 0.05, LAT), 200); // ~5km > 200m
        DeliveryPersonnel campusDefault = dp("def", new GeoJsonPoint(LNG + 0.05, LAT), null); // null range
        DeliveryPersonnel noGps = dp("nogps", null, 200);                               // no location
        activeDps(inRange, outRange, campusDefault, noGps);

        engine.assignOrder(readyOrder());

        assertThat(offeredTo()).containsExactlyInAnyOrder("in", "def", "nogps");
        assertThat(offeredTo()).doesNotContain("out");
    }

    @Test
    void offerPayloadCarriesEarningsAndCollectAmount() {
        DeliveryPersonnel preIncentive = dp("in", new GeoJsonPoint(LNG, LAT), null);
        preIncentive.setIncentiveActive(false);
        activeDps(preIncentive);

        engine.assignOrder(readyOrder());

        ArgumentCaptor<Map> payload = ArgumentCaptor.forClass(Map.class);
        verify(socket).emitToUser(eq("in"), eq("delivery:request"), payload.capture());
        Map<?, ?> p = payload.getValue();
        // Pre-incentive dasher: (15 fee - 5 commission) + 10 tip = 20.
        assertThat(((Number) p.get("earnings")).doubleValue()).isEqualTo(20.0);
        assertThat(((Number) p.get("amountToCollect")).doubleValue()).isEqualTo(114.0); // COD
        assertThat(p.get("paidViaGcash")).isEqualTo(false);
        assertThat(p.get("incentiveProgress")).isEqualTo("0/5");
    }

    @Test
    void incentiveActiveDasherEarnsFullFee() {
        DeliveryPersonnel postIncentive = dp("in", new GeoJsonPoint(LNG, LAT), null);
        postIncentive.setIncentiveActive(true);
        activeDps(postIncentive);

        engine.assignOrder(readyOrder());

        ArgumentCaptor<Map> payload = ArgumentCaptor.forClass(Map.class);
        verify(socket).emitToUser(eq("in"), eq("delivery:request"), payload.capture());
        // Post-incentive: full 15 fee + 10 tip = 25.
        assertThat(((Number) payload.getValue().get("earnings")).doubleValue()).isEqualTo(25.0);
    }

    @Test
    void rebroadcastIgnoresRangeAndFiresOnce() {
        DeliveryPersonnel outRange = dp("out", new GeoJsonPoint(LNG + 0.05, LAT), 200);
        activeDps(outRange);
        when(orderRepo.save(any(Order.class))).thenAnswer(i -> i.getArgument(0));

        Order order = readyOrder();
        engine.rebroadcastToAll(order);

        // Out-of-range dasher IS offered on re-broadcast.
        verify(socket).emitToUser(eq("out"), eq("delivery:request"), any());
        assertThat(order.getRebroadcastAt()).isNotNull();

        // Second call is a no-op (rebroadcastAt already set).
        engine.rebroadcastToAll(order);
        verify(socket, times(1)).emitToUser(eq("out"), eq("delivery:request"), any());
    }

    @Test
    void customerRatingHiddenBelowThreshold() {
        when(userRepo.findById("cust1")).thenReturn(Optional.of(
                User.builder().id("cust1").ratingAvg(4.8).ratingCount(2).build())); // < 3
        activeDps(dp("in", new GeoJsonPoint(LNG, LAT), null));

        engine.assignOrder(readyOrder());

        ArgumentCaptor<Map> payload = ArgumentCaptor.forClass(Map.class);
        verify(socket).emitToUser(eq("in"), eq("delivery:request"), payload.capture());
        assertThat(payload.getValue().get("customerRating")).isNull();
    }
}
