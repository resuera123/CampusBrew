package com.campusbrew.campusbrew_api.service;

import com.campusbrew.campusbrew_api.model.*;
import com.campusbrew.campusbrew_api.repository.OrderRepository;
import com.campusbrew.campusbrew_api.repository.ShopRepository;
import com.campusbrew.campusbrew_api.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * The rider search starts when the shop accepts; the shop can mark the order
 * ready only once a dasher has claimed it.
 */
class RiderFirstFlowTest {

    private OrderRepository orders;
    private DeliveryAssignmentEngine engine;
    private OrderService service;
    private Order order;

    @BeforeEach
    void setUp() {
        orders = mock(OrderRepository.class);
        engine = mock(DeliveryAssignmentEngine.class);
        ShopRepository shops = mock(ShopRepository.class);
        UserRepository users = mock(UserRepository.class);
        when(users.findById("op")).thenReturn(Optional.of(User.builder().id("op").role(UserRole.SHOP_OPERATOR).build()));
        when(shops.findById("s1")).thenReturn(Optional.of(Shop.builder().id("s1").operatorId("op").shopName("Brew").build()));
        order = Order.builder().id("o1").shopId("s1").customerId("c1").orderStatus(OrderStatus.PLACED)
                .paymentMethod(PaymentMethod.COD).paymentStatus(PaymentStatus.PENDING_COD)
                .items(List.of(OrderItem.builder().itemName("Latte").quantity(1).build()))
                .statusHistory(new ArrayList<>()).build();
        when(orders.findById("o1")).thenAnswer(i -> Optional.of(order));
        when(orders.save(any(Order.class))).thenAnswer(i -> i.getArgument(0));
        service = new OrderService(orders, shops, users, mock(ShopService.class), mock(PaymentService.class),
                engine, mock(SocketService.class), mock(PushNotificationService.class), mock(ConfigService.class));
    }

    @Test
    void acceptingStartsTheRiderSearchAndTheTimer() {
        service.acceptOrder("op", "o1");

        assertThat(order.getOrderStatus()).isEqualTo(OrderStatus.PREPARING);
        assertThat(order.getRiderSearchAt()).isNotNull();
        verify(engine).assignOrder(order);
    }

    @Test
    void cantMarkReadyBeforeARiderAccepts() {
        order.setOrderStatus(OrderStatus.PREPARING);

        assertThatThrownBy(() -> service.markReady("op", "o1")).hasMessageContaining("Wait for a rider");
        assertThat(order.getOrderStatus()).isEqualTo(OrderStatus.PREPARING);
    }

    @Test
    void marksReadyOnceARiderIsAssigned() {
        order.setOrderStatus(OrderStatus.ASSIGNED);
        order.setDeliveryPersonnelId("dasher");

        service.markReady("op", "o1");

        assertThat(order.getOrderStatus()).isEqualTo(OrderStatus.READY_FOR_PICKUP);
        assertThat(order.getReadyAt()).isNotNull();
    }

    @Test
    void cancellingAfterARiderAcceptedReleasesThem() {
        order.setOrderStatus(OrderStatus.ASSIGNED);
        order.setDeliveryPersonnelId("dasher");

        service.rejectOrder("op", "o1");

        assertThat(order.getOrderStatus()).isEqualTo(OrderStatus.CANCELLED);
        verify(engine).releaseDasher("dasher", "o1");
    }

    @Test
    void onlyUnclaimedAcceptedOrdersAwaitARider() {
        assertThat(DeliveryAssignmentEngine.awaitingRider(
                Order.builder().orderStatus(OrderStatus.PREPARING).build())).isTrue();
        assertThat(DeliveryAssignmentEngine.awaitingRider(
                Order.builder().orderStatus(OrderStatus.PREPARING).deliveryPersonnelId("d").build())).isFalse();
        assertThat(DeliveryAssignmentEngine.awaitingRider(
                Order.builder().orderStatus(OrderStatus.PLACED).build())).isFalse();
    }
}
