package com.campusbrew.campusbrew_api.dto;

import com.campusbrew.campusbrew_api.model.Order;
import com.campusbrew.campusbrew_api.model.OrderStatus;
import com.campusbrew.campusbrew_api.model.PaymentMethod;
import com.campusbrew.campusbrew_api.model.PaymentStatus;
import com.campusbrew.campusbrew_api.model.StatusHistoryEntry;
import lombok.Builder;
import lombok.Data;

import java.util.Date;
import java.util.List;
import java.util.stream.Collectors;

@Data
@Builder
public class OrderDTO {
    private String id;
    private String customerId;
    private String customerName;
    private String shopId;
    private String shopName;
    private String deliveryPersonnelId;
    private String deliveryPersonnelName;
    // v2.0 FR-2.1/3.6 — dasher's average on the order detail; null below rating.minCountToShow.
    private Double deliveryPersonnelRating;
    private List<OrderItemDTO> items;
    private String deliveryLocation;
    private String dasherInstructions;
    private PaymentMethod paymentMethod;
    private PaymentStatus paymentStatus;
    private OrderStatus orderStatus;
    private double beverageSubtotal;
    private double deliveryFee;
    private double platformCommission;
    private double tip;
    private double totalAmount;
    private String dropoffNote;
    private String paymentUrl;
    // v2.0 FR-4.1 — when true, no order exists yet: the client must open paymentUrl and
    // poll GET /api/payments/{paymentId} until the status leaves PENDING.
    private boolean paymentRequired;
    private String paymentId;
    private List<StatusHistoryEntry> statusHistory;
    private Date readyAt;
    private Date createdAt;
    private Date updatedAt;

    public static OrderDTO fromOrder(Order order, String shopName, String paymentUrl) {
        return fromOrder(order, shopName, paymentUrl, null, null);
    }

    public static OrderDTO fromOrder(Order order, String shopName, String paymentUrl, String customerName) {
        return fromOrder(order, shopName, paymentUrl, customerName, null);
    }

    public static OrderDTO fromOrder(Order order, String shopName, String paymentUrl,
                                     String customerName, String deliveryPersonnelName) {
        return OrderDTO.builder()
                .id(order.getId())
                .customerId(order.getCustomerId())
                .customerName(customerName)
                .shopId(order.getShopId())
                .shopName(shopName)
                .deliveryPersonnelId(order.getDeliveryPersonnelId())
                .deliveryPersonnelName(deliveryPersonnelName)
                .items(order.getItems().stream()
                        .map(OrderItemDTO::fromOrderItem)
                        .collect(Collectors.toList()))
                .deliveryLocation(order.getDeliveryLocation())
                .dasherInstructions(order.getDasherInstructions())
                .paymentMethod(order.getPaymentMethod())
                .paymentStatus(order.getPaymentStatus())
                .orderStatus(order.getOrderStatus())
                .beverageSubtotal(order.getBeverageSubtotal())
                .deliveryFee(order.getDeliveryFee())
                .platformCommission(order.getPlatformCommission())
                .tip(order.getTip())
                .totalAmount(order.getTotalAmount())
                .dropoffNote(order.getDropoffNote())
                .paymentUrl(paymentUrl)
                .statusHistory(order.getStatusHistory())
                .readyAt(order.getReadyAt())
                .createdAt(order.getCreatedAt())
                .updatedAt(order.getUpdatedAt())
                .build();
    }

    /**
     * v2.0 FR-4.1 — a "no order yet, pay first" response for GCash checkout. Carries the
     * draft's amounts for the confirmation UI plus the checkout URL and payment id to poll.
     */
    public static OrderDTO paymentRequired(Order draft, String shopName,
                                           String paymentId, String checkoutUrl) {
        return OrderDTO.builder()
                .id(null)
                .customerId(draft.getCustomerId())
                .shopId(draft.getShopId())
                .shopName(shopName)
                .items(draft.getItems().stream()
                        .map(OrderItemDTO::fromOrderItem)
                        .collect(Collectors.toList()))
                .deliveryLocation(draft.getDeliveryLocation())
                .dasherInstructions(draft.getDasherInstructions())
                .paymentMethod(draft.getPaymentMethod())
                .paymentStatus(draft.getPaymentStatus())
                .beverageSubtotal(draft.getBeverageSubtotal())
                .deliveryFee(draft.getDeliveryFee())
                .platformCommission(draft.getPlatformCommission())
                .tip(draft.getTip())
                .totalAmount(draft.getTotalAmount())
                .dropoffNote(draft.getDropoffNote())
                .paymentUrl(checkoutUrl)
                .paymentRequired(true)
                .paymentId(paymentId)
                .build();
    }
}
