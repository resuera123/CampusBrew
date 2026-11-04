package com.campusbrew.campusbrew_api.service;

import com.campusbrew.campusbrew_api.model.Order;
import com.campusbrew.campusbrew_api.model.OrderItem;
import com.campusbrew.campusbrew_api.model.PaymentMethod;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** The shop operator's "New order received" push text. */
class ShopOrderPushTest {

    @Test
    void summarisesTheOrderForTheShop() {
        Order order = Order.builder()
                .id("6650aa11bb22cc33f9041f")
                .items(List.of(
                        OrderItem.builder().itemName("Kape Suada").quantity(2).build(),
                        OrderItem.builder().itemName("Matcha").quantity(1).build()))
                .beverageSubtotal(208)
                .paymentMethod(PaymentMethod.GCASH)
                .build();

        assertThat(OrderService.shopOrderSummary(order)).isEqualTo("Order #F9041F · 3 items · ₱208.00 · GCash");

        order.setItems(List.of(OrderItem.builder().itemName("Tea").quantity(1).build()));
        order.setPaymentMethod(PaymentMethod.COD);
        order.setBeverageSubtotal(50);
        assertThat(OrderService.shopOrderSummary(order)).isEqualTo("Order #F9041F · 1 item · ₱50.00 · COD");
    }
}
