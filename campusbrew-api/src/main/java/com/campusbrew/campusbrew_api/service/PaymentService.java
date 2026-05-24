package com.campusbrew.campusbrew_api.service;

import com.campusbrew.campusbrew_api.model.Order;
import com.campusbrew.campusbrew_api.model.PaymentMethod;
import com.campusbrew.campusbrew_api.model.PaymentStatus;
import lombok.AllArgsConstructor;
import lombok.Data;
import org.springframework.stereotype.Service;

@Service
public class PaymentService {

    public PaymentInitResult initiate(Order order) {
        if (order.getPaymentMethod() == PaymentMethod.COD) {
            return new PaymentInitResult(PaymentStatus.PENDING_COD, null);
        }
        // GCash: Xendit integration lands in Module 4. Until then, mark PENDING.
        return new PaymentInitResult(PaymentStatus.PENDING, null);
    }

    @Data
    @AllArgsConstructor
    public static class PaymentInitResult {
        private PaymentStatus status;
        private String paymentUrl;
    }
}
