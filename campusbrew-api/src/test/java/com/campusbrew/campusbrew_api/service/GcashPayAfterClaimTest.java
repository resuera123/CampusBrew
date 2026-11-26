package com.campusbrew.campusbrew_api.service;

import com.campusbrew.campusbrew_api.dto.CreateOrderDTO;
import com.campusbrew.campusbrew_api.dto.CreateOrderItemDTO;
import com.campusbrew.campusbrew_api.dto.OrderDTO;
import com.campusbrew.campusbrew_api.model.*;
import com.campusbrew.campusbrew_api.payment.XenditClient;
import com.campusbrew.campusbrew_api.repository.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

import java.util.*;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * FR-4.1 — GCash pay-after-claim: a GCash order is placed without a charge, the
 * customer pays only once a dasher has claimed it, an unpaid order is cancelled
 * when the window closes (nothing to refund), and a payment that lands after the
 * order was cancelled is refunded.
 */
class GcashPayAfterClaimTest {

    private OrderRepository orders;
    private PaymentRepository payments;
    private XenditClient xendit;
    private DeliveryAssignmentEngine engine;
    private ConfigService config;
    private PaymentService paymentService;
    private OrderService service;
    private Order order;
    private final Map<String, Payment> paymentStore = new HashMap<>();

    @BeforeEach
    void setUp() {
        orders = mock(OrderRepository.class);
        payments = mock(PaymentRepository.class);
        xendit = mock(XenditClient.class);
        engine = mock(DeliveryAssignmentEngine.class);
        config = mock(ConfigService.class);
        when(config.getDeliveryFee()).thenReturn(15.0);
        when(config.getCommission()).thenReturn(5.0);
        when(config.getCodLimit()).thenReturn(300.0);
        when(config.getTipMaxAmount()).thenReturn(100.0);
        when(config.getXenditCallbackToken()).thenReturn("secret-token");

        paymentStore.clear();
        when(payments.save(any(Payment.class))).thenAnswer(inv -> {
            Payment p = inv.getArgument(0);
            if (p.getId() == null) p.setId("pay_" + (paymentStore.size() + 1));
            paymentStore.put(p.getId(), p);
            return p;
        });
        when(payments.findById(anyString())).thenAnswer(inv -> Optional.ofNullable(paymentStore.get(inv.getArgument(0))));
        when(payments.findByOrderIdAndType(anyString(), any(PaymentType.class))).thenAnswer(inv ->
                paymentStore.values().stream()
                        .filter(p -> inv.getArgument(0).equals(p.getOrderId()) && inv.getArgument(1) == p.getType())
                        .toList());
        when(xendit.createGcashCharge(anyString(), anyDouble()))
                .thenAnswer(inv -> new XenditClient.ChargeResult("ewc_" + inv.getArgument(0), "https://checkout/" + inv.getArgument(0)));
        paymentService = new PaymentService(payments, xendit, config);

        ShopRepository shops = mock(ShopRepository.class);
        when(shops.findById("s1")).thenReturn(Optional.of(Shop.builder().id("s1").operatorId("op").shopName("Brew").build()));
        UserRepository users = mock(UserRepository.class);
        when(users.findById("c1")).thenReturn(Optional.of(User.builder().id("c1").verificationStatus(VerificationStatus.VERIFIED).build()));
        when(users.findById("op")).thenReturn(Optional.of(User.builder().id("op").role(UserRole.SHOP_OPERATOR).build()));
        ShopService shopService = mock(ShopService.class);
        when(shopService.requireMenuItem("item1")).thenReturn(
                MenuItem.builder().id("item1").shopId("s1").name("Latte").price(100).isAvailable(true).build());

        order = Order.builder().id("o1").shopId("s1").customerId("c1").deliveryPersonnelId("dasher")
                .orderStatus(OrderStatus.ASSIGNED).paymentMethod(PaymentMethod.GCASH)
                .paymentStatus(PaymentStatus.AWAITING_PAYMENT).totalAmount(115.0)
                .paymentDueAt(new Date(System.currentTimeMillis() + 300_000))
                .items(List.of(OrderItem.builder().itemName("Latte").quantity(1).build()))
                .statusHistory(new ArrayList<>()).build();
        when(orders.findById("o1")).thenAnswer(i -> Optional.of(order));
        when(orders.save(any(Order.class))).thenAnswer(i -> {
            Order o = i.getArgument(0);
            if (o.getId() == null) o.setId("new1");
            return o;
        });

        service = new OrderService(orders, shops, users, shopService, paymentService, engine,
                mock(SocketService.class), mock(PushNotificationService.class), config);
    }

    private CreateOrderDTO gcashCart() {
        CreateOrderItemDTO line = new CreateOrderItemDTO();
        line.setMenuItemId("item1");
        line.setQuantity(1);
        CreateOrderDTO dto = new CreateOrderDTO();
        dto.setShopId("s1");
        dto.setDeliveryLocation("GLE Lobby");
        dto.setPaymentMethod(PaymentMethod.GCASH);
        dto.setItems(List.of(line));
        return dto;
    }

    @Test
    void gcashOrderIsPlacedWithoutCharging() {
        OrderDTO placed = service.createOrder("c1", gcashCart());

        assertThat(placed.getId()).isEqualTo("new1");
        assertThat(placed.isPaymentRequired()).isFalse();
        assertThat(placed.getPaymentStatus()).isEqualTo(PaymentStatus.AWAITING_PAYMENT);
        assertThat(placed.getOrderStatus()).isEqualTo(OrderStatus.PLACED);
        verifyNoInteractions(xendit);
    }

    @Test
    void cantPayBeforeARiderAccepts() {
        order.setOrderStatus(OrderStatus.PREPARING);
        order.setDeliveryPersonnelId(null);

        assertThatThrownBy(() -> service.payForOrder("c1", "o1")).hasMessageContaining("once a rider");
        verifyNoInteractions(xendit);
    }

    @Test
    void onlyTheCustomerCanPayAndOnlyInsideTheWindow() {
        assertThatThrownBy(() -> service.payForOrder("someoneElse", "o1")).hasMessageContaining("Not your order");

        order.setPaymentDueAt(new Date(System.currentTimeMillis() - 1000));
        assertThatThrownBy(() -> service.payForOrder("c1", "o1")).hasMessageContaining("window has closed");
        verifyNoInteractions(xendit);
    }

    @Test
    void payingTwiceReopensTheSameCharge() {
        Map<String, Object> first = service.payForOrder("c1", "o1");
        Map<String, Object> second = service.payForOrder("c1", "o1");

        assertThat(first.get("paymentUrl")).isEqualTo("https://checkout/pay_1");
        assertThat(second.get("paymentId")).isEqualTo(first.get("paymentId"));
        verify(xendit, times(1)).createGcashCharge(anyString(), eq(115.0));
        assertThat(paymentStore.get("pay_1").getOrderId()).isEqualTo("o1");
    }

    @Test
    void paidWebhookMarksTheExistingOrderPaid() {
        service.payForOrder("c1", "o1");
        PaymentService.WebhookOutcome outcome = paymentService.processWebhook("secret-token",
                new ObjectMapper().valueToTree(Map.of("data", Map.of(
                        "reference_id", "pay_1", "id", "ewc_pay_1", "status", "SUCCEEDED", "charge_amount", 115.0))));

        assertThat(outcome.isShouldCreateOrder()).isFalse();
        assertThat(outcome.isShouldMarkOrderPaid()).isTrue();
        service.markGcashOrderPaid(outcome.getPayment());

        assertThat(order.getPaymentStatus()).isEqualTo(PaymentStatus.PAID_GCASH);
        assertThat(order.getPaymentDueAt()).isNull();
        assertThat(order.getOrderStatus()).isEqualTo(OrderStatus.ASSIGNED);
    }

    @Test
    void shopCantMarkReadyUntilPaid() {
        assertThatThrownBy(() -> service.markReady("op", "o1")).hasMessageContaining("GCash payment");
        assertThat(order.getOrderStatus()).isEqualTo(OrderStatus.ASSIGNED);

        order.setPaymentStatus(PaymentStatus.PAID_GCASH);
        service.markReady("op", "o1");
        assertThat(order.getOrderStatus()).isEqualTo(OrderStatus.READY_FOR_PICKUP);
    }

    @Test
    void unpaidOrderIsCancelledWhenTheWindowCloses() {
        service.payForOrder("c1", "o1"); // a charge was opened but never paid
        when(orders.findByOrderStatusAndPaymentStatusAndPaymentDueAtLessThan(
                eq(OrderStatus.ASSIGNED), eq(PaymentStatus.AWAITING_PAYMENT), any(Date.class)))
                .thenReturn(List.of(order));

        assertThat(service.expireUnpaidGcashOrders()).isEqualTo(1);

        assertThat(order.getOrderStatus()).isEqualTo(OrderStatus.CANCELLED);
        assertThat(order.getPaymentStatus()).isEqualTo(PaymentStatus.AWAITING_PAYMENT); // never charged
        assertThat(paymentStore.get("pay_1").getStatus()).isEqualTo(PaymentRecordStatus.EXPIRED);
        verify(engine).releaseDasher(eq("dasher"), eq("o1"), contains("didn't pay"));
        verify(xendit, never()).refund(anyString(), anyDouble());
    }

    @Test
    void paymentArrivingAfterCancellationIsRefunded() {
        service.payForOrder("c1", "o1");
        order.setOrderStatus(OrderStatus.CANCELLED);
        Payment p = paymentStore.get("pay_1");
        p.setStatus(PaymentRecordStatus.EXPIRED);

        PaymentService.WebhookOutcome outcome = paymentService.processWebhook("secret-token",
                new ObjectMapper().valueToTree(Map.of("data", Map.of(
                        "reference_id", "pay_1", "id", "ewc_pay_1", "status", "SUCCEEDED", "charge_amount", 115.0))));
        service.markGcashOrderPaid(outcome.getPayment());

        verify(xendit).refund("ewc_pay_1", 115.0);
        assertThat(order.getPaymentStatus()).isEqualTo(PaymentStatus.REFUNDED);
        assertThat(order.getOrderStatus()).isEqualTo(OrderStatus.CANCELLED);
    }

    @Test
    void claimingAnUnpaidGcashOrderStartsThePaymentWindow() {
        MongoTemplate mongo = mock(MongoTemplate.class);
        DeliveryPersonnelRepository dpRepo = mock(DeliveryPersonnelRepository.class);
        DeliveryAssignmentRepository assignRepo = mock(DeliveryAssignmentRepository.class);
        ShopRepository shops = mock(ShopRepository.class);
        UserRepository users = mock(UserRepository.class);
        PushNotificationService push = mock(PushNotificationService.class);
        when(config.getGcashPayWindowMinutes()).thenReturn(5);
        when(dpRepo.findByUserId("dasher")).thenReturn(Optional.of(DeliveryPersonnel.builder().userId("dasher").build()));
        Order claimed = Order.builder().id("o9").customerId("c1").shopId("s1").deliveryPersonnelId("dasher")
                .orderStatus(OrderStatus.ASSIGNED).paymentMethod(PaymentMethod.GCASH)
                .paymentStatus(PaymentStatus.AWAITING_PAYMENT).build();
        when(mongo.findAndModify(any(Query.class), any(Update.class), any(FindAndModifyOptions.class), eq(Order.class)))
                .thenReturn(claimed);
        DeliveryAssignmentEngine realEngine = new DeliveryAssignmentEngine(mongo, assignRepo, dpRepo,
                mock(OrderRepository.class), shops, users, mock(SocketService.class), config, push);

        long before = System.currentTimeMillis();
        realEngine.claimFromMarketplace("dasher", "o9");

        assertThat(claimed.getPaymentDueAt()).isNotNull();
        long windowMs = claimed.getPaymentDueAt().getTime() - before;
        assertThat(windowMs).isBetween(299_000L, 301_000L);
        verify(mongo).updateFirst(any(Query.class), any(Update.class), eq(Order.class));
        verify(push).send(eq("c1"), contains("pay now"), anyString(), anyMap());
    }
}
