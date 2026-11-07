package com.campusbrew.campusbrew_api.service;

import com.campusbrew.campusbrew_api.dto.PaymentCenterEntryDTO;
import com.campusbrew.campusbrew_api.dto.PaymentCenterResponse;
import com.campusbrew.campusbrew_api.model.*;
import com.campusbrew.campusbrew_api.payment.PaymentException;
import com.campusbrew.campusbrew_api.repository.*;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.util.Date;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/** A cancelled GCash order is refunded, and the refund shows in the customer's Payment Center. */
class RefundFlowTest {

    private OrderService orderService(OrderRepository orders, PaymentService payments) {
        ShopRepository shops = mock(ShopRepository.class);
        UserRepository users = mock(UserRepository.class);
        when(users.findById("op")).thenReturn(Optional.of(User.builder().id("op").role(UserRole.SHOP_OPERATOR).build()));
        when(shops.findById("s1")).thenReturn(Optional.of(Shop.builder().id("s1").operatorId("op").shopName("Brew").build()));
        when(orders.save(any(Order.class))).thenAnswer(i -> i.getArgument(0));
        return new OrderService(orders, shops, users, mock(ShopService.class), payments,
                mock(DeliveryAssignmentEngine.class), mock(SocketService.class),
                mock(PushNotificationService.class), mock(ConfigService.class));
    }

    private static Order gcashOrder() {
        return Order.builder().id("o1").shopId("s1").customerId("c1").orderStatus(OrderStatus.PLACED)
                .paymentMethod(PaymentMethod.GCASH).paymentStatus(PaymentStatus.PAID_GCASH).totalAmount(120)
                .items(List.of(OrderItem.builder().itemName("Latte").quantity(1).build())).build();
    }

    @Test
    void rejectingAPaidGcashOrderRefundsIt() {
        OrderRepository orders = mock(OrderRepository.class);
        PaymentService payments = mock(PaymentService.class);
        Order order = gcashOrder();
        when(orders.findById("o1")).thenReturn(Optional.of(order));
        when(payments.refund("o1")).thenReturn(true);

        orderService(orders, payments).rejectOrder("op", "o1");

        verify(payments).refund("o1");
        assertThat(order.getOrderStatus()).isEqualTo(OrderStatus.CANCELLED);
        assertThat(order.getPaymentStatus()).isEqualTo(PaymentStatus.REFUNDED);
    }

    @Test
    void aFailedRefundStaysPendingForTheRetry() {
        OrderRepository orders = mock(OrderRepository.class);
        PaymentService payments = mock(PaymentService.class);
        Order order = gcashOrder();
        when(orders.findById("o1")).thenReturn(Optional.of(order));
        when(payments.refund("o1")).thenThrow(new PaymentException("Refund could not be processed.", null));

        orderService(orders, payments).rejectOrder("op", "o1");

        assertThat(order.getOrderStatus()).isEqualTo(OrderStatus.CANCELLED);
        assertThat(order.getPaymentStatus()).isEqualTo(PaymentStatus.REFUND_PENDING);
    }

    @Test
    void paymentCenterListsRefundsAndPendingRefunds() {
        UserRepository users = mock(UserRepository.class);
        PaymentRepository paymentRepo = mock(PaymentRepository.class);
        OrderRepository orderRepo = mock(OrderRepository.class);
        when(users.findById("c1")).thenReturn(Optional.of(User.builder().id("c1").role(UserRole.CUSTOMER).build()));
        Date refundedAt = new Date();
        Payment refunded = Payment.builder().id("p1").userId("c1").orderId("o1").type(PaymentType.ORDER)
                .amount(120).status(PaymentRecordStatus.REFUNDED).refundedAt(refundedAt)
                .createdAt(new Date(refundedAt.getTime() - 60_000)).build();
        when(paymentRepo.findByUserIdOrderByCreatedAtDesc(eq("c1"), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(refunded)));
        Order pending = Order.builder().id("o2").customerId("c1").paymentMethod(PaymentMethod.GCASH)
                .paymentStatus(PaymentStatus.REFUND_PENDING).orderStatus(OrderStatus.CANCELLED)
                .totalAmount(80).createdAt(new Date()).build();
        Order cancelledCod = Order.builder().id("o3").customerId("c1").paymentMethod(PaymentMethod.COD)
                .paymentStatus(PaymentStatus.PENDING_COD).orderStatus(OrderStatus.CANCELLED)
                .totalAmount(50).createdAt(new Date()).build();
        when(orderRepo.findByCustomerIdOrderByCreatedAtDesc(eq("c1"), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(pending, cancelledCod)));

        PaymentCenterResponse res = new PaymentCenterService(users, paymentRepo, mock(TransactionRepository.class),
                orderRepo, mock(ShopRepository.class), mock(ReportRepository.class)).forUser("c1", null);

        List<PaymentCenterEntryDTO> refunds = res.getEntries().stream().filter(e -> "REFUND".equals(e.getSource())).toList();
        assertThat(refunds).extracting(PaymentCenterEntryDTO::getStatus).containsExactlyInAnyOrder("REFUNDED", "REFUND_PENDING");
        assertThat(refunds).filteredOn(e -> "REFUNDED".equals(e.getStatus()))
                .singleElement().satisfies(e -> {
                    assertThat(e.getAmount()).isEqualTo(120);
                    assertThat(e.getCreatedAt()).isEqualTo(refundedAt);
                });
        // A cancelled COD order was never paid, so it isn't listed as a payment.
        assertThat(res.getEntries()).noneMatch(e -> "o3".equals(e.getOrderId()));
        assertThat(res.getSummary().get("totalPaid")).isZero();
    }
}
