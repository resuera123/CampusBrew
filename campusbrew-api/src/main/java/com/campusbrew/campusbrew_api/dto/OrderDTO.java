package com.campusbrew.campusbrew_api.dto;

import com.campusbrew.campusbrew_api.model.Order;
import com.campusbrew.campusbrew_api.model.OrderStatus;
import com.campusbrew.campusbrew_api.model.PaymentMethod;
import com.campusbrew.campusbrew_api.model.PaymentStatus;
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
    private String shopId;
    private String shopName;
    private String deliveryPersonnelId;
    private List<OrderItemDTO> items;
    private String deliveryLocation;
    private PaymentMethod paymentMethod;
    private PaymentStatus paymentStatus;
    private OrderStatus orderStatus;
    private double beverageSubtotal;
    private double deliveryFee;
    private double platformCommission;
    private double totalAmount;
    private String paymentUrl;
    private Date createdAt;
    private Date updatedAt;

    public static OrderDTO fromOrder(Order order, String shopName, String paymentUrl) {
        return OrderDTO.builder()
                .id(order.getId())
                .customerId(order.getCustomerId())
                .shopId(order.getShopId())
                .shopName(shopName)
                .deliveryPersonnelId(order.getDeliveryPersonnelId())
                .items(order.getItems().stream()
                        .map(OrderItemDTO::fromOrderItem)
                        .collect(Collectors.toList()))
                .deliveryLocation(order.getDeliveryLocation())
                .paymentMethod(order.getPaymentMethod())
                .paymentStatus(order.getPaymentStatus())
                .orderStatus(order.getOrderStatus())
                .beverageSubtotal(order.getBeverageSubtotal())
                .deliveryFee(order.getDeliveryFee())
                .platformCommission(order.getPlatformCommission())
                .totalAmount(order.getTotalAmount())
                .paymentUrl(paymentUrl)
                .createdAt(order.getCreatedAt())
                .updatedAt(order.getUpdatedAt())
                .build();
    }
}
