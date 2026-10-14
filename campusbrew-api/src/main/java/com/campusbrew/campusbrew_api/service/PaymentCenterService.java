package com.campusbrew.campusbrew_api.service;

import com.campusbrew.campusbrew_api.dto.PaymentCenterEntryDTO;
import com.campusbrew.campusbrew_api.dto.PaymentCenterResponse;
import com.campusbrew.campusbrew_api.model.*;
import com.campusbrew.campusbrew_api.repository.OrderRepository;
import com.campusbrew.campusbrew_api.repository.PaymentRepository;
import com.campusbrew.campusbrew_api.repository.ShopRepository;
import com.campusbrew.campusbrew_api.repository.TransactionRepository;
import com.campusbrew.campusbrew_api.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * v2.0 FR-4.8 — Payment Center. Normalizes the payments and transactions collections
 * into one role-appropriate history plus a few headline totals.
 */
@Service
@RequiredArgsConstructor
public class PaymentCenterService {

    private static final Pageable BIG = PageRequest.of(0, 500, Sort.by(Sort.Direction.DESC, "createdAt"));

    private final UserRepository userRepository;
    private final PaymentRepository paymentRepository;
    private final TransactionRepository transactionRepository;
    private final OrderRepository orderRepository;
    private final ShopRepository shopRepository;

    public PaymentCenterResponse forUser(String userId, String typeFilter) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        return switch (user.getRole()) {
            case DELIVERY_PERSONNEL -> forDasher(userId);
            case SHOP_OPERATOR -> forShop(userId);
            default -> forCustomer(userId, typeFilter);
        };
    }

    // ---- Customer: GCash payments + tips + COD orders ----

    private PaymentCenterResponse forCustomer(String userId, String typeFilter) {
        List<PaymentCenterEntryDTO> entries = new ArrayList<>();
        double totalPaid = 0;

        for (Payment p : paymentRepository.findByUserIdOrderByCreatedAtDesc(userId, BIG)) {
            if (typeFilter != null && !typeFilter.isBlank()
                    && !typeFilter.equalsIgnoreCase(p.getType().name())) {
                continue;
            }
            entries.add(PaymentCenterEntryDTO.builder()
                    .id(p.getId()).source("PAYMENT").kind(p.getType().name())
                    .orderId(p.getOrderId()).method("GCASH").status(p.getStatus().name())
                    .amount(p.getAmount()).referenceNo(p.getReferenceNo())
                    .reported(p.isReported())
                    .description(p.getType() == PaymentType.TIP ? "Tip" : "Order payment")
                    .createdAt(p.getCreatedAt()).build());
            if (p.getStatus() == PaymentRecordStatus.PAID) totalPaid += p.getAmount();
        }

        // COD orders have no payments doc; surface them from the orders collection.
        if (typeFilter == null || typeFilter.isBlank() || typeFilter.equalsIgnoreCase("ORDER")) {
            for (Order o : orderRepository.findByCustomerIdOrderByCreatedAtDesc(userId, BIG)) {
                if (o.getPaymentMethod() != PaymentMethod.COD) continue;
                entries.add(PaymentCenterEntryDTO.builder()
                        .id(o.getId()).source("COD_ORDER").kind("ORDER")
                        .orderId(o.getId()).method("COD")
                        .status(o.getPaymentStatus() == null ? "PENDING_COD" : o.getPaymentStatus().name())
                        .amount(o.getTotalAmount()).description("Cash on delivery")
                        .createdAt(o.getCreatedAt()).build());
                if (o.getPaymentStatus() == PaymentStatus.PAID_COD) totalPaid += o.getTotalAmount();
            }
        }

        sortNewestFirst(entries);
        return PaymentCenterResponse.builder()
                .role("CUSTOMER")
                .summary(map("totalPaid", round(totalPaid)))
                .entries(entries).build();
    }

    // ---- Dasher: earnings, tips, cash collected, shop payments ----

    private PaymentCenterResponse forDasher(String userId) {
        List<PaymentCenterEntryDTO> entries = new ArrayList<>();
        double earnings = 0, tips = 0, cashCollected = 0, shopPayments = 0;

        for (Transaction t : transactionRepository.findByDeliveryPersonnelIdOrderByCreatedAtDesc(userId)) {
            earnings += t.getDpEarnings();
            tips += t.getTip();
            boolean cod = t.getPaymentMethod() == PaymentMethod.COD;
            if (cod) {
                cashCollected += t.getBeverageCost() + t.getDeliveryFee() + t.getTip();
                shopPayments += t.getBeverageCost();
            }
            entries.add(PaymentCenterEntryDTO.builder()
                    .id(t.getId()).source("TRANSACTION").kind("DELIVERY")
                    .orderId(t.getOrderId())
                    .method(t.getPaymentMethod() == null ? null : t.getPaymentMethod().name())
                    .status(t.getStatus().name()).amount(t.getDpEarnings())
                    .description("Delivery earnings" + (t.getTip() > 0 ? " (incl. ₱" + (int) t.getTip() + " tip)" : ""))
                    .createdAt(t.getCreatedAt()).build());
        }

        sortNewestFirst(entries);
        Map<String, Double> summary = new LinkedHashMap<>();
        summary.put("earnings", round(earnings));
        summary.put("tips", round(tips));
        summary.put("cashCollected", round(cashCollected));
        summary.put("shopPayments", round(shopPayments));
        return PaymentCenterResponse.builder().role("DELIVERY_PERSONNEL").summary(summary).entries(entries).build();
    }

    // ---- Shop: payments received from dashers per order ----

    private PaymentCenterResponse forShop(String operatorUserId) {
        List<PaymentCenterEntryDTO> entries = new ArrayList<>();
        double received = 0;

        for (Shop shop : shopRepository.findByOperatorId(operatorUserId)) {
            for (Transaction t : transactionRepository.findByShopIdOrderByCreatedAtDesc(shop.getId())) {
                received += t.getBeverageCost();
                entries.add(PaymentCenterEntryDTO.builder()
                        .id(t.getId()).source("TRANSACTION").kind("SHOP_RECEIPT")
                        .orderId(t.getOrderId())
                        .method(t.getPaymentMethod() == null ? null : t.getPaymentMethod().name())
                        .status(t.getStatus().name()).amount(t.getBeverageCost())
                        .description("Payment received").createdAt(t.getCreatedAt()).build());
            }
        }

        sortNewestFirst(entries);
        return PaymentCenterResponse.builder()
                .role("SHOP_OPERATOR")
                .summary(map("received", round(received)))
                .entries(entries).build();
    }

    // ---- Report a problem (payments only) ----

    public void report(String userId, String paymentId, String note) {
        Payment p = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new RuntimeException("Payment not found"));
        if (!userId.equals(p.getUserId())) {
            throw new RuntimeException("Not your payment");
        }
        p.setReported(true);
        p.setReportNote(note);
        paymentRepository.save(p);
    }

    // ---- helpers ----

    private static void sortNewestFirst(List<PaymentCenterEntryDTO> entries) {
        entries.sort(Comparator.comparing(
                PaymentCenterEntryDTO::getCreatedAt,
                Comparator.nullsLast(Comparator.reverseOrder())));
    }

    private static Map<String, Double> map(String k, double v) {
        Map<String, Double> m = new LinkedHashMap<>();
        m.put(k, v);
        return m;
    }

    private static double round(double v) {
        return Math.round(v * 100.0) / 100.0;
    }
}
