package com.campusbrew.campusbrew_api.service;

import com.campusbrew.campusbrew_api.dto.CreateOrderDTO;
import com.campusbrew.campusbrew_api.dto.CreateOrderItemDTO;
import com.campusbrew.campusbrew_api.dto.OrderDTO;
import com.campusbrew.campusbrew_api.model.*;
import com.campusbrew.campusbrew_api.repository.OrderRepository;
import com.campusbrew.campusbrew_api.repository.ShopRepository;
import com.campusbrew.campusbrew_api.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.mockito.ArgumentCaptor;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/**
 * v2.0 FR-2.2/4.7 — checkout guards: COD ceiling, tip cap, tip folded into the total.
 */
class OrderCheckoutTest {

    private OrderRepository orderRepository;
    private ShopRepository shopRepository;
    private UserRepository userRepository;
    private ShopService shopService;
    private PaymentService paymentService;
    private DeliveryAssignmentEngine assignmentEngine;
    private SocketService socketService;
    private ConfigService config;
    private OrderService service;

    @BeforeEach
    void setUp() {
        orderRepository = mock(OrderRepository.class);
        shopRepository = mock(ShopRepository.class);
        userRepository = mock(UserRepository.class);
        shopService = mock(ShopService.class);
        paymentService = mock(PaymentService.class);
        assignmentEngine = mock(DeliveryAssignmentEngine.class);
        socketService = mock(SocketService.class);
        config = mock(ConfigService.class);

        when(config.getDeliveryFee()).thenReturn(15.0);
        when(config.getCommission()).thenReturn(5.0);
        when(config.getCodLimit()).thenReturn(300.0);
        when(config.getTipMaxAmount()).thenReturn(100.0);

        User verified = User.builder().id("cust1").verificationStatus(VerificationStatus.VERIFIED).build();
        when(userRepository.findById("cust1")).thenReturn(Optional.of(verified));

        Shop shop = Shop.builder().id("shop1").shopName("Brew").build();
        when(shopRepository.findById("shop1")).thenReturn(Optional.of(shop));

        when(orderRepository.save(any(Order.class))).thenAnswer(inv -> {
            Order o = inv.getArgument(0);
            if (o.getId() == null) o.setId("order1");
            return o;
        });

        service = new OrderService(orderRepository, shopRepository, userRepository, shopService,
                paymentService, assignmentEngine, socketService, config);
    }

    /** A ₱priced menu item for the one cart line. */
    private void menuItemPriced(double price) {
        MenuItem item = MenuItem.builder().id("item1").shopId("shop1").name("Latte")
                .price(price).isAvailable(true).build();
        when(shopService.requireMenuItem("item1")).thenReturn(item);
    }

    private CreateOrderDTO dto(PaymentMethod method, Double tip) {
        CreateOrderItemDTO line = new CreateOrderItemDTO();
        line.setMenuItemId("item1");
        line.setQuantity(1);
        CreateOrderDTO dto = new CreateOrderDTO();
        dto.setShopId("shop1");
        dto.setDeliveryLocation("GLE Lobby");
        dto.setPaymentMethod(method);
        dto.setItems(List.of(line));
        dto.setTip(tip);
        return dto;
    }

    @Test
    void codOverTheLimitIsRejected() {
        menuItemPriced(300); // 300 + 15 fee = 315 > 300 limit
        when(paymentService.initiate(any())).thenReturn(
                new PaymentService.PaymentInitResult(PaymentStatus.PENDING_COD, null));

        assertThatThrownBy(() -> service.createOrder("cust1", dto(PaymentMethod.COD, 0.0)))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("Cash on Delivery");
        verify(orderRepository, never()).save(any());
    }

    @Test
    void codWithinTheLimitSucceeds() {
        menuItemPriced(100); // 100 + 15 = 115 <= 300
        when(paymentService.initiate(any())).thenReturn(
                new PaymentService.PaymentInitResult(PaymentStatus.PENDING_COD, null));

        OrderDTO result = service.createOrder("cust1", dto(PaymentMethod.COD, 0.0));
        assertThat(result.getTotalAmount()).isEqualTo(115.0);
        verify(orderRepository).save(any());
    }

    @Test
    void tipAboveTheCapIsRejected() {
        menuItemPriced(100);
        assertThatThrownBy(() -> service.createOrder("cust1", dto(PaymentMethod.GCASH, 150.0)))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("Tip");
    }

    @Test
    void identicalLinesAreMergedServerSide() {
        menuItemPriced(100);
        when(paymentService.initiate(any())).thenReturn(
                new PaymentService.PaymentInitResult(PaymentStatus.PENDING_COD, null));

        // Two identical lines (same item, no options) sent separately.
        CreateOrderItemDTO a = new CreateOrderItemDTO();
        a.setMenuItemId("item1"); a.setQuantity(1);
        CreateOrderItemDTO b = new CreateOrderItemDTO();
        b.setMenuItemId("item1"); b.setQuantity(1);
        CreateOrderDTO dto = new CreateOrderDTO();
        dto.setShopId("shop1");
        dto.setDeliveryLocation("GLE Lobby");
        dto.setPaymentMethod(PaymentMethod.COD);
        dto.setItems(List.of(a, b));

        ArgumentCaptor<Order> captor = ArgumentCaptor.forClass(Order.class);
        service.createOrder("cust1", dto);
        verify(orderRepository).save(captor.capture());

        Order saved = captor.getValue();
        assertThat(saved.getItems()).hasSize(1);            // merged into one line
        assertThat(saved.getItems().get(0).getQuantity()).isEqualTo(2);
        assertThat(saved.getTotalAmount()).isEqualTo(215.0); // 200 beverages + 15 fee
    }

    @Test
    void tipIsAddedToTheTotal() {
        menuItemPriced(100); // 100 + 15 fee + 20 tip = 135
        when(paymentService.initiateGcashCheckout(any(), anyString(), anyString()))
                .thenAnswer(inv -> {
                    Order draft = inv.getArgument(0);
                    return OrderDTO.paymentRequired(draft, "Brew", "pay1", "http://checkout");
                });

        OrderDTO result = service.createOrder("cust1", dto(PaymentMethod.GCASH, 20.0));
        assertThat(result.getTip()).isEqualTo(20.0);
        assertThat(result.getTotalAmount()).isEqualTo(135.0);
        assertThat(result.isPaymentRequired()).isTrue();
    }
}
