package com.campusbrew.campusbrew_api.dto;

import com.campusbrew.campusbrew_api.model.PaymentMethod;
import lombok.Data;

import java.util.List;

@Data
public class CreateOrderDTO {
    private String shopId;
    private List<CreateOrderItemDTO> items;
    private String deliveryLocation;
    private PaymentMethod paymentMethod;
}
