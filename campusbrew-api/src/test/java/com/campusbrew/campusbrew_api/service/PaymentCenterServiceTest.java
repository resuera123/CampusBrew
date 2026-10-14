package com.campusbrew.campusbrew_api.service;

import com.campusbrew.campusbrew_api.dto.PaymentCenterResponse;
import com.campusbrew.campusbrew_api.model.*;
import com.campusbrew.campusbrew_api.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.util.Date;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/** v2.0 FR-4.8 — Payment Center aggregation per role, and report. */
class PaymentCenterServiceTest {

    private UserRepository userRepo;
    private PaymentRepository paymentRepo;
    private TransactionRepository txRepo;
    private OrderRepository orderRepo;
    private ShopRepository shopRepo;
    private PaymentCenterService service;

    @BeforeEach
    void setUp() {
        userRepo = mock(UserRepository.class);
        paymentRepo = mock(PaymentRepository.class);
        txRepo = mock(TransactionRepository.class);
        orderRepo = mock(OrderRepository.class);
        shopRepo = mock(ShopRepository.class);
        service = new PaymentCenterService(userRepo, paymentRepo, txRepo, orderRepo, shopRepo);
    }

    private void role(String userId, UserRole r) {
        when(userRepo.findById(userId)).thenReturn(Optional.of(User.builder().id(userId).role(r).build()));
    }

    @Test
    void customerSeesGcashPaymentsAndCodOrdersWithTotalPaid() {
        role("c1", UserRole.CUSTOMER);
        Payment paid = Payment.builder().id("p1").userId("c1").type(PaymentType.ORDER)
                .method(PaymentMethod.GCASH).amount(119).status(PaymentRecordStatus.PAID)
                .referenceNo("ewc_1").createdAt(new Date()).build();
        when(paymentRepo.findByUserIdOrderByCreatedAtDesc(eq("c1"), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(paid)));
        Order cod = Order.builder().id("o1").customerId("c1").paymentMethod(PaymentMethod.COD)
                .paymentStatus(PaymentStatus.PAID_COD).totalAmount(80).createdAt(new Date()).build();
        when(orderRepo.findByCustomerIdOrderByCreatedAtDesc(eq("c1"), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(cod)));

        PaymentCenterResponse res = service.forUser("c1", null);

        assertThat(res.getRole()).isEqualTo("CUSTOMER");
        assertThat(res.getEntries()).hasSize(2);
        assertThat(res.getSummary().get("totalPaid")).isEqualTo(199.0); // 119 + 80
    }

    @Test
    void customerTypeFilterLimitsToTips() {
        role("c1", UserRole.CUSTOMER);
        Payment tip = Payment.builder().id("t1").userId("c1").type(PaymentType.TIP)
                .amount(20).status(PaymentRecordStatus.PAID).createdAt(new Date()).build();
        Payment order = Payment.builder().id("p1").userId("c1").type(PaymentType.ORDER)
                .amount(119).status(PaymentRecordStatus.PAID).createdAt(new Date()).build();
        when(paymentRepo.findByUserIdOrderByCreatedAtDesc(eq("c1"), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(tip, order)));

        PaymentCenterResponse res = service.forUser("c1", "TIP");
        assertThat(res.getEntries()).hasSize(1);
        assertThat(res.getEntries().get(0).getKind()).isEqualTo("TIP");
    }

    @Test
    void dasherSeesEarningsTipsAndCashCollected() {
        role("d1", UserRole.DELIVERY_PERSONNEL);
        Transaction codTx = Transaction.builder().id("tx1").deliveryPersonnelId("d1").orderId("o1")
                .beverageCost(100).deliveryFee(15).platformCommission(0).dpEarnings(25).tip(10)
                .paymentMethod(PaymentMethod.COD).status(TransactionStatus.COMPLETED).createdAt(new Date()).build();
        when(txRepo.findByDeliveryPersonnelIdOrderByCreatedAtDesc("d1")).thenReturn(List.of(codTx));

        PaymentCenterResponse res = service.forUser("d1", null);

        assertThat(res.getRole()).isEqualTo("DELIVERY_PERSONNEL");
        assertThat(res.getSummary().get("earnings")).isEqualTo(25.0);
        assertThat(res.getSummary().get("tips")).isEqualTo(10.0);
        assertThat(res.getSummary().get("cashCollected")).isEqualTo(125.0); // 100 + 15 + 10
        assertThat(res.getSummary().get("shopPayments")).isEqualTo(100.0);
    }

    @Test
    void shopSeesReceivedPerOrder() {
        role("s1", UserRole.SHOP_OPERATOR);
        when(shopRepo.findByOperatorId("s1")).thenReturn(List.of(Shop.builder().id("shop1").build()));
        Transaction tx = Transaction.builder().id("tx1").shopId("shop1").orderId("o1")
                .beverageCost(100).status(TransactionStatus.COMPLETED).createdAt(new Date()).build();
        when(txRepo.findByShopIdOrderByCreatedAtDesc("shop1")).thenReturn(List.of(tx));

        PaymentCenterResponse res = service.forUser("s1", null);
        assertThat(res.getRole()).isEqualTo("SHOP_OPERATOR");
        assertThat(res.getSummary().get("received")).isEqualTo(100.0);
        assertThat(res.getEntries()).hasSize(1);
    }

    @Test
    void reportMarksThePaymentOnlyForItsOwner() {
        Payment p = Payment.builder().id("p1").userId("c1").status(PaymentRecordStatus.PAID).build();
        when(paymentRepo.findById("p1")).thenReturn(Optional.of(p));

        service.report("c1", "p1", "charged twice");
        assertThat(p.isReported()).isTrue();
        assertThat(p.getReportNote()).isEqualTo("charged twice");
        verify(paymentRepo).save(p);

        assertThatThrownBy(() -> service.report("someone-else", "p1", "x"))
                .isInstanceOf(RuntimeException.class).hasMessageContaining("Not your payment");
    }
}
