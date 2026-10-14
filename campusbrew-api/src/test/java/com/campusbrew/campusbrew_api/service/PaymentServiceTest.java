package com.campusbrew.campusbrew_api.service;

import com.campusbrew.campusbrew_api.model.*;
import com.campusbrew.campusbrew_api.payment.InvalidCallbackTokenException;
import com.campusbrew.campusbrew_api.payment.XenditClient;
import com.campusbrew.campusbrew_api.repository.PaymentRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/**
 * v2.0 FR-4.1 — the money-critical webhook logic: order created exactly once on PAID,
 * never on failure, idempotent on duplicates, amount-checked, token-guarded; plus refund.
 */
class PaymentServiceTest {

    private PaymentRepository repo;
    private XenditClient xendit;
    private ConfigService config;
    private PaymentService service;
    private final ObjectMapper mapper = new ObjectMapper();

    private final Map<String, Payment> store = new HashMap<>();

    @BeforeEach
    void setUp() {
        repo = mock(PaymentRepository.class);
        xendit = mock(XenditClient.class);
        config = mock(ConfigService.class);
        when(config.getXenditCallbackToken()).thenReturn("secret-token");

        // In-memory stand-in for the repository, with id assignment on save.
        store.clear();
        when(repo.save(any(Payment.class))).thenAnswer(inv -> {
            Payment p = inv.getArgument(0);
            if (p.getId() == null) p.setId("pay_" + (store.size() + 1));
            store.put(p.getId(), p);
            return p;
        });
        when(repo.findById(anyString())).thenAnswer(inv -> Optional.ofNullable(store.get(inv.getArgument(0))));
        when(repo.findByGatewayChargeId(anyString())).thenAnswer(inv ->
                store.values().stream().filter(p -> inv.getArgument(0).equals(p.getGatewayChargeId())).findFirst());
        when(repo.findByOrderId(anyString())).thenAnswer(inv ->
                store.values().stream().filter(p -> inv.getArgument(0).equals(p.getOrderId())).findFirst());

        service = new PaymentService(repo, xendit, config);
    }

    private Payment pendingOrderPayment(double amount) {
        Order draft = Order.builder().customerId("cust1").shopId("shop1")
                .items(new ArrayList<>()).totalAmount(amount).build();
        Payment p = Payment.builder()
                .userId("cust1").type(PaymentType.ORDER).method(PaymentMethod.GCASH)
                .amount(amount).status(PaymentRecordStatus.PENDING).orderDraft(draft)
                .webhookEvents(new ArrayList<>()).createdAt(new Date()).build();
        return repo.save(p);
    }

    private JsonNode webhook(String referenceId, String chargeId, String status, double amount) {
        Map<String, Object> data = new HashMap<>();
        data.put("reference_id", referenceId);
        data.put("id", chargeId);
        data.put("status", status);
        data.put("charge_amount", amount);
        return mapper.valueToTree(Map.of("event", "ewallet.capture", "data", data));
    }

    @Test
    void successfulWebhookMarksPaidAndSignalsOrderCreation() {
        Payment p = pendingOrderPayment(150);
        p.setGatewayChargeId("ewc_1");
        repo.save(p);

        PaymentService.WebhookOutcome out =
                service.processWebhook("secret-token", webhook(p.getId(), "ewc_1", "SUCCEEDED", 150));

        assertThat(out.isShouldCreateOrder()).isTrue();
        assertThat(store.get(p.getId()).getStatus()).isEqualTo(PaymentRecordStatus.PAID);
        assertThat(store.get(p.getId()).getReferenceNo()).isEqualTo("ewc_1");
    }

    @Test
    void failedWebhookNeverCreatesAnOrder() {
        Payment p = pendingOrderPayment(150);

        PaymentService.WebhookOutcome out =
                service.processWebhook("secret-token", webhook(p.getId(), "ewc_1", "FAILED", 150));

        assertThat(out.isShouldCreateOrder()).isFalse();
        assertThat(store.get(p.getId()).getStatus()).isEqualTo(PaymentRecordStatus.FAILED);
    }

    @Test
    void duplicatePaidWebhookIsIdempotent() {
        Payment p = pendingOrderPayment(150);

        PaymentService.WebhookOutcome first =
                service.processWebhook("secret-token", webhook(p.getId(), "ewc_1", "SUCCEEDED", 150));
        PaymentService.WebhookOutcome second =
                service.processWebhook("secret-token", webhook(p.getId(), "ewc_1", "SUCCEEDED", 150));

        assertThat(first.isShouldCreateOrder()).isTrue();
        assertThat(second.isShouldCreateOrder()).isFalse(); // no second order
    }

    @Test
    void orderIsNotCreatedTwiceOnceAttached() {
        Payment p = pendingOrderPayment(150);
        service.processWebhook("secret-token", webhook(p.getId(), "ewc_1", "SUCCEEDED", 150));
        service.attachOrder(p.getId(), "order_1"); // simulate the order materialized

        PaymentService.WebhookOutcome third =
                service.processWebhook("secret-token", webhook(p.getId(), "ewc_1", "SUCCEEDED", 150));
        assertThat(third.isShouldCreateOrder()).isFalse();
    }

    @Test
    void amountMismatchDoesNotComplete() {
        Payment p = pendingOrderPayment(150);

        PaymentService.WebhookOutcome out =
                service.processWebhook("secret-token", webhook(p.getId(), "ewc_1", "SUCCEEDED", 50));

        assertThat(out.isShouldCreateOrder()).isFalse();
        assertThat(store.get(p.getId()).getStatus()).isEqualTo(PaymentRecordStatus.PENDING);
    }

    @Test
    void wrongCallbackTokenIsRejected() {
        Payment p = pendingOrderPayment(150);
        assertThatThrownBy(() ->
                service.processWebhook("WRONG", webhook(p.getId(), "ewc_1", "SUCCEEDED", 150)))
                .isInstanceOf(InvalidCallbackTokenException.class);
        assertThat(store.get(p.getId()).getStatus()).isEqualTo(PaymentRecordStatus.PENDING);
    }

    @Test
    void unknownPaymentIsANoop() {
        PaymentService.WebhookOutcome out =
                service.processWebhook("secret-token", webhook("nope", "ewc_x", "SUCCEEDED", 150));
        assertThat(out.isShouldCreateOrder()).isFalse();
    }

    @Test
    void expirySweepsOnlyStalePending() {
        Payment fresh = pendingOrderPayment(150);
        Payment stale = pendingOrderPayment(150);
        stale.setCreatedAt(new Date(System.currentTimeMillis() - 20 * 60 * 1000)); // 20 min ago
        repo.save(stale);
        when(repo.findByStatus(PaymentRecordStatus.PENDING))
                .thenReturn(new ArrayList<>(List.of(fresh, stale)));

        int expired = service.expireStalePending();

        assertThat(expired).isEqualTo(1);
        assertThat(store.get(stale.getId()).getStatus()).isEqualTo(PaymentRecordStatus.EXPIRED);
        assertThat(store.get(fresh.getId()).getStatus()).isEqualTo(PaymentRecordStatus.PENDING);
    }

    @Test
    void refundCallsGatewayAndMarksRefunded() {
        Payment p = pendingOrderPayment(150);
        p.setStatus(PaymentRecordStatus.PAID);
        p.setGatewayChargeId("ewc_1");
        p.setOrderId("order_1");
        repo.save(p);

        service.refund("order_1");

        verify(xendit).refund("ewc_1", 150);
        assertThat(store.get(p.getId()).getStatus()).isEqualTo(PaymentRecordStatus.REFUNDED);
    }

    @Test
    void refundIsNoopForUnpaidOrCod() {
        Payment p = pendingOrderPayment(150); // still PENDING
        p.setOrderId("order_2");
        repo.save(p);

        service.refund("order_2");

        verify(xendit, never()).refund(anyString(), anyDouble());
        assertThat(store.get(p.getId()).getStatus()).isEqualTo(PaymentRecordStatus.PENDING);
    }
}
