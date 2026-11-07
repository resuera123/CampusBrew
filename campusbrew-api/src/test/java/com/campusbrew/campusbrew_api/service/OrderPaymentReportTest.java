package com.campusbrew.campusbrew_api.service;

import com.campusbrew.campusbrew_api.model.*;
import com.campusbrew.campusbrew_api.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** A dasher or shop operator reporting a problem with an order's payment. */
class OrderPaymentReportTest {

    private PaymentRepository paymentRepo;
    private ReportRepository reportRepo;
    private PaymentCenterService service;

    @BeforeEach
    void setUp() {
        paymentRepo = mock(PaymentRepository.class);
        reportRepo = mock(ReportRepository.class);
        OrderRepository orderRepo = mock(OrderRepository.class);
        ShopRepository shopRepo = mock(ShopRepository.class);
        service = new PaymentCenterService(mock(UserRepository.class), paymentRepo,
                mock(TransactionRepository.class), orderRepo, shopRepo, reportRepo);

        when(orderRepo.findById("o1")).thenReturn(Optional.of(
                Order.builder().id("o1").shopId("s1").deliveryPersonnelId("dasher").customerId("c1").build()));
        when(shopRepo.findById("s1")).thenReturn(Optional.of(Shop.builder().id("s1").operatorId("op").build()));
        when(paymentRepo.findByOrderIdAndType("o1", PaymentType.ORDER)).thenReturn(List.of());
    }

    @Test
    void theShopOperatorCanReportACodOrder() {
        service.reportOrder("op", "o1", "  Dasher handed over ₱20 less  ");

        ArgumentCaptor<Report> saved = ArgumentCaptor.forClass(Report.class);
        verify(reportRepo).save(saved.capture());
        assertThat(saved.getValue().getType()).isEqualTo(ReportType.PAYMENT);
        assertThat(saved.getValue().getOrderId()).isEqualTo("o1");
        assertThat(saved.getValue().getPaymentId()).isNull(); // COD: no payment record
        assertThat(saved.getValue().getNote()).isEqualTo("Dasher handed over ₱20 less");
        assertThat(saved.getValue().getReporterId()).isEqualTo("op");
    }

    @Test
    void theDasherCanReportAndItLinksTheGcashPayment() {
        when(paymentRepo.findByOrderIdAndType("o1", PaymentType.ORDER))
                .thenReturn(List.of(Payment.builder().id("pay1").build()));

        service.reportOrder("dasher", "o1", "Earnings missing");

        ArgumentCaptor<Report> saved = ArgumentCaptor.forClass(Report.class);
        verify(reportRepo).save(saved.capture());
        assertThat(saved.getValue().getPaymentId()).isEqualTo("pay1");
    }

    @Test
    void onlyTheOrdersDasherOrShopCanReport() {
        assertThatThrownBy(() -> service.reportOrder("stranger", "o1", "Hmm"))
                .hasMessageContaining("delivered or sold");
        verify(reportRepo, never()).save(any());
    }

    @Test
    void needsANoteAndOnlyOncePerPerson() {
        assertThatThrownBy(() -> service.reportOrder("op", "o1", "  ")).hasMessageContaining("what went wrong");
        when(reportRepo.existsByTypeAndOrderIdAndReporterId(ReportType.PAYMENT, "o1", "op")).thenReturn(true);
        assertThatThrownBy(() -> service.reportOrder("op", "o1", "Again")).hasMessageContaining("already reported");
        assertThat(service.orderReported("op", "o1")).isTrue();
    }
}
