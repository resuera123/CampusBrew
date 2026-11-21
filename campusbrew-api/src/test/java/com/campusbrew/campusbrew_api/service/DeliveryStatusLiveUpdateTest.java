package com.campusbrew.campusbrew_api.service;

import com.campusbrew.campusbrew_api.model.*;
import com.campusbrew.campusbrew_api.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.ArrayList;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Defect D-10 (found in the 21 Nov 2026 retest): the customer's tracking screen listens for
 * order:statusUpdate on the customer's own feed, but pickup and delivery only sent it to the
 * order room, so the screen stayed on "Ready for Pickup" / "Out for Delivery" until reopened.
 */
class DeliveryStatusLiveUpdateTest {

    private OrderRepository orders;
    private SocketService socket;
    private DeliveryFulfillmentService service;
    private Order order;

    @BeforeEach
    void setUp() {
        orders = mock(OrderRepository.class);
        socket = mock(SocketService.class);
        ShopRepository shops = mock(ShopRepository.class);
        DeliveryPersonnelRepository dps = mock(DeliveryPersonnelRepository.class);
        ConfigService config = mock(ConfigService.class);
        when(config.getIncentiveThreshold()).thenReturn(5);
        when(shops.findById("shop1")).thenReturn(Optional.of(Shop.builder().id("shop1").shopName("Brew").operatorId("op1").build()));
        when(dps.findByUserId("dp1")).thenReturn(Optional.of(DeliveryPersonnel.builder().userId("dp1").totalDeliveries(0).build()));
        when(orders.save(any(Order.class))).thenAnswer(inv -> inv.getArgument(0));
        service = new DeliveryFulfillmentService(orders, dps, shops, mock(TransactionRepository.class), socket, config,
                mock(PushNotificationService.class), mock(ItemSalesService.class));
        order = Order.builder().id("o1").customerId("c1").shopId("shop1").deliveryPersonnelId("dp1")
                .orderStatus(OrderStatus.READY_FOR_PICKUP).paymentMethod(PaymentMethod.GCASH)
                .items(new ArrayList<>()).statusHistory(new ArrayList<>())
                .beverageSubtotal(89).deliveryFee(15).platformCommission(5).tip(0).totalAmount(104).build();
        when(orders.findById("o1")).thenReturn(Optional.of(order));
    }

    @SuppressWarnings("unchecked")
    private String statusSentToCustomer() {
        ArgumentCaptor<Object> payload = ArgumentCaptor.forClass(Object.class);
        verify(socket, atLeastOnce()).emitToUser(eq("c1"), eq("order:statusUpdate"), payload.capture());
        return String.valueOf(((Map<String, Object>) payload.getValue()).get("status"));
    }

    @Test
    void pickupTellsTheCustomerLive() {
        service.markPickedUp("dp1", "o1");
        assertThat(statusSentToCustomer()).isEqualTo("OUT_FOR_DELIVERY");
    }

    @Test
    void deliveryTellsTheCustomerLive() {
        order.setOrderStatus(OrderStatus.OUT_FOR_DELIVERY);
        service.completeDelivery(order);
        assertThat(statusSentToCustomer()).isEqualTo("DELIVERED");
    }
}
