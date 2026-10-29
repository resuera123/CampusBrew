package com.campusbrew.campusbrew_api.service;

import com.campusbrew.campusbrew_api.dto.TipStatusDTO;
import com.campusbrew.campusbrew_api.model.Order;
import com.campusbrew.campusbrew_api.model.OrderStatus;
import com.campusbrew.campusbrew_api.model.Payment;
import com.campusbrew.campusbrew_api.model.PaymentRecordStatus;
import com.campusbrew.campusbrew_api.model.PaymentType;
import com.campusbrew.campusbrew_api.model.StatusHistoryEntry;
import com.campusbrew.campusbrew_api.model.Transaction;
import com.campusbrew.campusbrew_api.model.User;
import com.campusbrew.campusbrew_api.repository.OrderRepository;
import com.campusbrew.campusbrew_api.repository.PaymentRepository;
import com.campusbrew.campusbrew_api.repository.TransactionRepository;
import com.campusbrew.campusbrew_api.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** v2.0 FR-4.7 — post-delivery tip: who, when, how much, once; credited 100% on PAID. */
class TipServiceTest {

    private OrderRepository orderRepo;
    private PaymentRepository paymentRepo;
    private TransactionRepository txRepo;
    private PaymentService paymentService;
    private SocketService socket;
    private PushNotificationService push;
    private TipService service;

    @BeforeEach
    void setUp() {
        orderRepo = mock(OrderRepository.class);
        paymentRepo = mock(PaymentRepository.class);
        txRepo = mock(TransactionRepository.class);
        UserRepository userRepo = mock(UserRepository.class);
        paymentService = mock(PaymentService.class);
        ConfigService config = mock(ConfigService.class);
        socket = mock(SocketService.class);
        push = mock(PushNotificationService.class);

        when(config.getTipMaxAmount()).thenReturn(100.0);
        when(config.getTipWindowHours()).thenReturn(24);
        when(userRepo.findById("d1")).thenReturn(Optional.of(User.builder().id("d1").fullName("Mark").build()));
        when(userRepo.findById("c1")).thenReturn(Optional.of(User.builder().id("c1").fullName("Juan").build()));
        when(paymentRepo.findByOrderIdAndType(anyString(), eq(PaymentType.TIP))).thenReturn(List.of());
        when(paymentService.initiateTipCharge(anyString(), anyString(), anyDouble()))
                .thenReturn(new PaymentService.TipCharge("pay_tip", "https://checkout/tip"));

        service = new TipService(orderRepo, paymentRepo, txRepo, userRepo, paymentService, config, socket, push);
    }

    private void order(OrderStatus status, Instant at) {
        when(orderRepo.findById("order123456")).thenReturn(Optional.of(Order.builder()
                .id("order123456").customerId("c1").deliveryPersonnelId("d1").orderStatus(status).tip(5)
                .statusHistory(List.of(StatusHistoryEntry.builder().status(status).timestamp(Date.from(at)).build()))
                .build()));
    }

    @Test
    void customerCanTipADeliveredOrder() {
        order(OrderStatus.DELIVERED, Instant.now());

        TipStatusDTO status = service.status("c1", "order123456");
        assertThat(status.isCanTip()).isTrue();
        assertThat(status.getDasherName()).isEqualTo("Mark");
        assertThat(status.getCheckoutTip()).isEqualTo(5);
        assertThat(status.getPresets()).containsExactly(5, 10, 20);

        PaymentService.TipCharge charge = service.start("c1", "order123456", 10);
        assertThat(charge.paymentUrl()).isEqualTo("https://checkout/tip");
        verify(paymentService).initiateTipCharge("c1", "order123456", 10.0);
    }

    @Test
    void onlyTheCustomerCanTip() {
        order(OrderStatus.DELIVERED, Instant.now());
        assertThatThrownBy(() -> service.start("d1", "order123456", 10)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.status("stranger", "order123456")).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void notBeforeDeliveryAndNotAfterTheWindow() {
        order(OrderStatus.OUT_FOR_DELIVERY, Instant.now());
        assertThatThrownBy(() -> service.start("c1", "order123456", 10)).isInstanceOf(IllegalStateException.class);

        order(OrderStatus.DELIVERED, Instant.now().minus(25, ChronoUnit.HOURS));
        assertThat(service.status("c1", "order123456").isCanTip()).isFalse();
        assertThatThrownBy(() -> service.start("c1", "order123456", 10)).isInstanceOf(IllegalStateException.class);
        verify(paymentService, never()).initiateTipCharge(anyString(), anyString(), anyDouble());
    }

    @Test
    void amountMustBeWithinLimits() {
        order(OrderStatus.DELIVERED, Instant.now());
        assertThatThrownBy(() -> service.start("c1", "order123456", 0)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.start("c1", "order123456", 150)).isInstanceOf(IllegalArgumentException.class);
        verify(paymentService, never()).initiateTipCharge(anyString(), anyString(), anyDouble());
    }

    @Test
    void onlyOnePostDeliveryTipPerOrder() {
        order(OrderStatus.DELIVERED, Instant.now());
        when(paymentRepo.findByOrderIdAndType("order123456", PaymentType.TIP)).thenReturn(List.of(
                Payment.builder().type(PaymentType.TIP).status(PaymentRecordStatus.PAID).amount(20).build()));

        TipStatusDTO status = service.status("c1", "order123456");
        assertThat(status.isCanTip()).isFalse();
        assertThat(status.getPostDeliveryTip()).isEqualTo(20);
        assertThatThrownBy(() -> service.start("c1", "order123456", 10)).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void failedTipDoesNotBlockARetry() {
        order(OrderStatus.DELIVERED, Instant.now());
        when(paymentRepo.findByOrderIdAndType("order123456", PaymentType.TIP)).thenReturn(List.of(
                Payment.builder().type(PaymentType.TIP).status(PaymentRecordStatus.FAILED).amount(20).build()));

        assertThat(service.status("c1", "order123456").isCanTip()).isTrue();
    }

    @Test
    void paidTipIsCreditedInFullAndDasherIsNotified() {
        order(OrderStatus.DELIVERED, Instant.now());
        Transaction tx = Transaction.builder().orderId("order123456").tip(5).dpEarnings(15).build();
        when(txRepo.findByOrderId("order123456")).thenReturn(Optional.of(tx));

        service.creditTip(Payment.builder().id("pay_tip").orderId("order123456").amount(20).build());

        assertThat(tx.getPostDeliveryTip()).isEqualTo(20);
        assertThat(tx.getDpEarnings()).isEqualTo(35);
        assertThat(tx.getTip()).isEqualTo(5); // checkout tip untouched (COD cash totals)
        verify(txRepo).save(tx);
        verify(socket).emitToUser(eq("d1"), eq("tip:received"), any());
        ArgumentCaptor<Map> data = ArgumentCaptor.forClass(Map.class);
        verify(push).send(eq("d1"), eq("You got a ₱20 tip!"), contains("Juan"), data.capture());
        assertThat(data.getValue().get("type")).isEqualTo("tip");
    }
}
