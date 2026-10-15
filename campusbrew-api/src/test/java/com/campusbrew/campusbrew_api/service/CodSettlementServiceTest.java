package com.campusbrew.campusbrew_api.service;

import com.campusbrew.campusbrew_api.dto.OrderDTO;
import com.campusbrew.campusbrew_api.model.*;
import com.campusbrew.campusbrew_api.repository.OrderRepository;
import com.campusbrew.campusbrew_api.repository.ShopRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * v2.0 FR-4.2 — COD settlement. The dasher's "Cash Collected" single-handedly
 * completes the order; the customer's confirmation is a secondary check that can
 * flag a mismatch but never completes the order itself.
 */
class CodSettlementServiceTest {

    private OrderRepository orderRepo;
    private ShopRepository shopRepo;
    private DeliveryFulfillmentService fulfillment;
    private SocketService socket;
    private CodSettlementService service;

    @BeforeEach
    void setUp() {
        orderRepo = mock(OrderRepository.class);
        shopRepo = mock(ShopRepository.class);
        fulfillment = mock(DeliveryFulfillmentService.class);
        socket = mock(SocketService.class);
        service = new CodSettlementService(orderRepo, shopRepo, fulfillment, socket);
        when(orderRepo.save(any(Order.class))).thenAnswer(i -> i.getArgument(0));
        when(fulfillment.completeDelivery(any(Order.class))).thenReturn(OrderDTO.builder().build());
    }

    private Order codOrder() {
        Order o = Order.builder().id("o1").customerId("c1").shopId("shop1").deliveryPersonnelId("d1")
                .paymentMethod(PaymentMethod.COD).paymentStatus(PaymentStatus.PENDING_COD)
                .orderStatus(OrderStatus.OUT_FOR_DELIVERY).totalAmount(114)
                .items(new ArrayList<>()).build();
        when(orderRepo.findById("o1")).thenReturn(Optional.of(o));
        return o;
    }

    @Test
    void dasherSingleTapCompletesAsPaidCod() {
        Order o = codOrder();
        service.recordDasherCollected("d1", "o1", 114);

        assertThat(o.getPaymentStatus()).isEqualTo(PaymentStatus.PAID_COD);
        verify(fulfillment, times(1)).completeDelivery(o); // dasher completes, no customer needed
    }

    @Test
    void customerConfirmAloneDoesNotComplete() {
        Order o = codOrder();
        service.recordCustomerConfirmed("c1", "o1", 114);

        assertThat(o.getCustomerConfirmedAmount()).isEqualTo(114.0);
        assertThat(o.getPaymentStatus()).isEqualTo(PaymentStatus.PENDING_COD); // unchanged
        verify(fulfillment, never()).completeDelivery(any());
    }

    @Test
    void customerConfirmBeforeDasherThenDasherCompletes() {
        Order o = codOrder();
        service.recordCustomerConfirmed("c1", "o1", 114); // customer first
        verify(fulfillment, never()).completeDelivery(any());

        service.recordDasherCollected("d1", "o1", 114);   // dasher completes
        assertThat(o.getPaymentStatus()).isEqualTo(PaymentStatus.PAID_COD);
        verify(fulfillment, times(1)).completeDelivery(o);
    }

    @Test
    void customerConfirmAfterDeliveryFlagsOnMismatch() {
        Order o = codOrder();
        service.recordDasherCollected("d1", "o1", 114); // completes as PAID_COD
        o.setOrderStatus(OrderStatus.DELIVERED);        // (completeDelivery is mocked)

        service.recordCustomerConfirmed("c1", "o1", 100); // mismatch
        assertThat(o.getPaymentStatus()).isEqualTo(PaymentStatus.FLAGGED);
        verify(fulfillment, times(1)).completeDelivery(o); // still only the dasher completed
    }

    @Test
    void matchingCustomerConfirmLeavesPaidCod() {
        Order o = codOrder();
        service.recordDasherCollected("d1", "o1", 114);
        o.setOrderStatus(OrderStatus.DELIVERED);

        service.recordCustomerConfirmed("c1", "o1", 114); // matches
        assertThat(o.getPaymentStatus()).isEqualTo(PaymentStatus.PAID_COD);
    }

    @Test
    void rejectsWrongDasherAndWrongCustomer() {
        codOrder();
        assertThatThrownBy(() -> service.recordDasherCollected("someone-else", "o1", 114))
                .hasMessageContaining("not assigned to you");
        assertThatThrownBy(() -> service.recordCustomerConfirmed("someone-else", "o1", 114))
                .hasMessageContaining("isn't your order");
    }

    @Test
    void rejectsNonCodOrder() {
        Order gcash = Order.builder().id("o2").paymentMethod(PaymentMethod.GCASH)
                .orderStatus(OrderStatus.OUT_FOR_DELIVERY).build();
        when(orderRepo.findById("o2")).thenReturn(Optional.of(gcash));
        assertThatThrownBy(() -> service.recordDasherCollected("d1", "o2", 100))
                .hasMessageContaining("not Cash on Delivery");
    }
}
