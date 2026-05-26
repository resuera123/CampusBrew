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
    private List<OrderItemDTO> items;
    private String deliveryLocation;
    private String dasherInstructions;
    private PaymentMethod paymentMethod;
    private PaymentStatus paymentStatus;
    private OrderStatus orderStatus;
    private double beverageSubtotal;
    private double deliveryFee;
    private double platformCommission;
    private double totalAmount;
    private String paymentUrl;
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
                .totalAmount(order.getTotalAmount())
                .paymentUrl(paymentUrl)
                .statusHistory(order.getStatusHistory())
                .readyAt(order.getReadyAt())
                .createdAt(order.getCreatedAt())
                .updatedAt(order.getUpdatedAt())
                .build();
    }
}
