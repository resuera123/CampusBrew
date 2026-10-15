package com.campusbrew.campusbrew_api.service;

import com.campusbrew.campusbrew_api.dto.OrderDTO;
import com.campusbrew.campusbrew_api.model.Order;
import com.campusbrew.campusbrew_api.model.OrderStatus;
import com.campusbrew.campusbrew_api.model.PaymentMethod;
import com.campusbrew.campusbrew_api.model.PaymentStatus;
import com.campusbrew.campusbrew_api.model.Shop;
import com.campusbrew.campusbrew_api.repository.OrderRepository;
import com.campusbrew.campusbrew_api.repository.ShopRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * v2.0 FR-4.2 — Cash-on-Delivery settlement.
 *
 * The dasher completes the delivery with a single tap (Cash Collected) — their
 * action is the one that finalizes the order (DELIVERED + transaction), via
 * DeliveryFulfillmentService so there is one completion path. The customer's
 * confirmation is a secondary check that records the amount they paid and flags
 * the payment (FLAGGED) if it doesn't match what the dasher recorded; it never
 * completes the order on its own.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CodSettlementService {

    /** Peso tolerance when comparing the two reported amounts. */
    private static final double TOLERANCE = 0.01;

    private final OrderRepository orderRepository;
    private final ShopRepository shopRepository;
    private final DeliveryFulfillmentService fulfillmentService;
    private final SocketService socketService;

    /**
     * Dasher taps "Cash Collected" and enters what they received. This single tap
     * completes the delivery. If the customer already confirmed a different amount,
     * the payment is flagged; otherwise it settles as PAID_COD.
     */
    public OrderDTO recordDasherCollected(String dpUserId, String orderId, double amount) {
        Order order = requireCod(orderId);
        if (order.getOrderStatus() != OrderStatus.OUT_FOR_DELIVERY) {
            throw new RuntimeException("Order is in status " + order.getOrderStatus()
                    + ", expected OUT_FOR_DELIVERY");
        }
        if (!dpUserId.equals(order.getDeliveryPersonnelId())) {
            throw new RuntimeException("This order is not assigned to you");
        }
        if (amount < 0) throw new RuntimeException("Amount cannot be negative");

        order.setCashCollectedAmount(amount);
        Double confirmed = order.getCustomerConfirmedAmount();
        boolean match = confirmed == null || Math.abs(amount - confirmed) <= TOLERANCE;
        order.setPaymentStatus(match ? PaymentStatus.PAID_COD : PaymentStatus.FLAGGED);

        OrderDTO result = fulfillmentService.completeDelivery(order); // DELIVERED + transaction
        emitSettled(order, match);
        return result;
    }

    /**
     * Customer confirms the amount they paid in cash. Records the amount and flags
     * the payment on a mismatch with the dasher's recorded amount, but does not
     * complete the order itself. Allowed while out for delivery or just after it is
     * delivered (the dasher usually completes first).
     */
    public OrderDTO recordCustomerConfirmed(String customerId, String orderId, double amount) {
        Order order = requireCod(orderId);
        if (!customerId.equals(order.getCustomerId())) {
            throw new RuntimeException("This isn't your order");
        }
        if (order.getOrderStatus() != OrderStatus.OUT_FOR_DELIVERY
                && order.getOrderStatus() != OrderStatus.DELIVERED) {
            throw new RuntimeException("Order is in status " + order.getOrderStatus()
                    + ", not awaiting payment confirmation");
        }
        if (amount < 0) throw new RuntimeException("Amount cannot be negative");

        order.setCustomerConfirmedAmount(amount);
        Double collected = order.getCashCollectedAmount();
        if (collected != null) {
            boolean match = Math.abs(collected - amount) <= TOLERANCE;
            if (!match && order.getPaymentStatus() == PaymentStatus.PAID_COD) {
                order.setPaymentStatus(PaymentStatus.FLAGGED);
            }
            emitSettled(order, match);
        }
        orderRepository.save(order);
        return toDTO(order);
    }

    private void emitSettled(Order order, boolean match) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("orderId", order.getId());
        payload.put("paymentStatus", order.getPaymentStatus().name());
        payload.put("matched", match);
        payload.put("collected", order.getCashCollectedAmount());
        payload.put("confirmed", order.getCustomerConfirmedAmount());
        socketService.emitToUser(order.getCustomerId(), "cod:settled", payload);
        if (order.getDeliveryPersonnelId() != null) {
            socketService.emitToUser(order.getDeliveryPersonnelId(), "cod:settled", payload);
        }
        if (!match) {
            log.warn("COD mismatch on order {}: dasher {} vs customer {} — FLAGGED",
                    order.getId(), order.getCashCollectedAmount(), order.getCustomerConfirmedAmount());
        }
    }

    private Order requireCod(String orderId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new RuntimeException("Order not found"));
        if (order.getPaymentMethod() != PaymentMethod.COD) {
            throw new RuntimeException("This order is not Cash on Delivery");
        }
        return order;
    }

    private OrderDTO toDTO(Order order) {
        String shopName = shopRepository.findById(order.getShopId())
                .map(Shop::getShopName).orElse(null);
        return OrderDTO.fromOrder(order, shopName, null);
    }
}
