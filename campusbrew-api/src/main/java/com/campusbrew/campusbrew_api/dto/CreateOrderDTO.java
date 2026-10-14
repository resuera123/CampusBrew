package com.campusbrew.campusbrew_api.dto;

import com.campusbrew.campusbrew_api.model.PaymentMethod;
import lombok.Data;

import java.util.List;

@Data
public class CreateOrderDTO {
    private String shopId;
    private List<CreateOrderItemDTO> items;
    private String deliveryLocation;
    private String dasherInstructions;
    private PaymentMethod paymentMethod;

    // v2.0 FR-2.2/4.7 — optional tip added to the total, paid 100% to the dasher.
    private Double tip;
    // v2.0 FR-3.4 — optional drop-off note shown to the dasher.
    private String dropoffNote;
}
