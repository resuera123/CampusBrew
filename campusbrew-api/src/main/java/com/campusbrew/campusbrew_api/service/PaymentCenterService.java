package com.campusbrew.campusbrew_api.service;

import com.campusbrew.campusbrew_api.dto.PaymentCenterEntryDTO;
import com.campusbrew.campusbrew_api.dto.PaymentCenterResponse;
import com.campusbrew.campusbrew_api.model.*;
import com.campusbrew.campusbrew_api.repository.OrderRepository;
import com.campusbrew.campusbrew_api.repository.PaymentRepository;
import com.campusbrew.campusbrew_api.repository.ShopRepository;
import com.campusbrew.campusbrew_api.repository.TransactionRepository;
import com.campusbrew.campusbrew_api.repository.UserRepository;
import com.campusbrew.campusbrew_api.model.Report;
import com.campusbrew.campusbrew_api.model.ReportStatus;
import com.campusbrew.campusbrew_api.model.ReportType;
import com.campusbrew.campusbrew_api.repository.ReportRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.util.Date;
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
    private final ReportRepository reportRepository;

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

        // Refunds of cancelled GCash orders, as their own lines (money back to the customer).
        boolean showRefunds = typeFilter == null || typeFilter.isBlank() || typeFilter.equalsIgnoreCase("REFUND");
        if (showRefunds) {
            for (Payment p : paymentRepository.findByUserIdOrderByCreatedAtDesc(userId, BIG)) {
                if (p.getStatus() != PaymentRecordStatus.REFUNDED) continue;
                entries.add(PaymentCenterEntryDTO.builder()
                        .id(p.getId() + "-refund").source("REFUND").kind("REFUND")
                        .orderId(p.getOrderId()).method("GCASH").status("REFUNDED")
                        .amount(p.getAmount()).referenceNo(p.getReferenceNo())
                        .description("Refund · order cancelled")
                        .createdAt(p.getRefundedAt() != null ? p.getRefundedAt() : p.getCreatedAt()).build());
            }
        }

        // COD orders have no payments doc; surface them from the orders collection.
        if (typeFilter == null || typeFilter.isBlank() || typeFilter.equalsIgnoreCase("ORDER")) {
            for (Order o : orderRepository.findByCustomerIdOrderByCreatedAtDesc(userId, BIG)) {
                if (o.getPaymentMethod() != PaymentMethod.COD) continue;
                if (o.getOrderStatus() == OrderStatus.CANCELLED) continue; // nothing was paid
                entries.add(PaymentCenterEntryDTO.builder()
                        .id(o.getId()).source("COD_ORDER").kind("ORDER")
                        .orderId(o.getId()).method("COD")
                        .status(o.getPaymentStatus() == null ? "PENDING_COD" : o.getPaymentStatus().name())
                        .amount(o.getTotalAmount()).description("Cash on delivery")
                        .createdAt(o.getCreatedAt()).build());
                if (o.getPaymentStatus() == PaymentStatus.PAID_COD) totalPaid += o.getTotalAmount();
            }
        }

        // A refund Xendit hasn't accepted yet (retried automatically).
        if (showRefunds) {
            for (Order o : orderRepository.findByCustomerIdOrderByCreatedAtDesc(userId, BIG)) {
                if (o.getPaymentStatus() != PaymentStatus.REFUND_PENDING) continue;
                entries.add(PaymentCenterEntryDTO.builder()
                        .id(o.getId() + "-refund").source("REFUND").kind("REFUND")
                        .orderId(o.getId()).method("GCASH").status("REFUND_PENDING")
                        .amount(o.getTotalAmount()).description("Refund pending · order cancelled")
                        .createdAt(o.getUpdatedAt() != null ? o.getUpdatedAt() : o.getCreatedAt()).build());
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
            double orderTips = t.getTip() + t.getPostDeliveryTip();
            tips += orderTips;
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
                    .reported(t.getOrderId() != null && reportRepository
                            .existsByTypeAndOrderIdAndReporterId(ReportType.PAYMENT, t.getOrderId(), userId))
                    .description("Delivery earnings" + (orderTips > 0 ? " (incl. ₱" + (int) orderTips + " tip)" : ""))
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
        // Queue it for the admin, once per payment while it's still open.
        if (!reportRepository.existsByTypeAndPaymentIdAndStatus(ReportType.PAYMENT, paymentId, ReportStatus.OPEN)) {
            reportRepository.save(Report.builder()
                    .type(ReportType.PAYMENT)
                    .reporterId(userId)
                    .orderId(p.getOrderId())
                    .paymentId(paymentId)
                    .note(note)
                    .status(ReportStatus.OPEN)
                    .createdAt(new Date())
                    .build());
        }
    }

    // ---- Report a problem with an order's payment (dasher, shop operator) ----

    static final int MAX_NOTE = 300;

    /**
     * Files a payment report about one order for its dasher or its shop operator
     * (customers report their own payments with {@link #report}). Links the order's
     * GCash payment when there is one; COD orders have none. One report per person
     * per order.
     */
    public void reportOrder(String userId, String orderId, String note) {
        String cleanNote = note == null ? "" : note.trim();
        if (cleanNote.isEmpty()) throw new RuntimeException("Tell us what went wrong");
        if (cleanNote.length() > MAX_NOTE) throw new RuntimeException("Keep it under " + MAX_NOTE + " characters");

        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new RuntimeException("Order not found"));
        if (!isOrderParty(userId, order)) {
            throw new RuntimeException("You can only report orders you delivered or sold");
        }
        if (reportRepository.existsByTypeAndOrderIdAndReporterId(ReportType.PAYMENT, orderId, userId)) {
            throw new RuntimeException("You already reported a problem with this order");
        }
        String paymentId = paymentRepository.findByOrderIdAndType(orderId, PaymentType.ORDER).stream()
                .findFirst().map(Payment::getId).orElse(null);
        reportRepository.save(Report.builder()
                .type(ReportType.PAYMENT)
                .reporterId(userId)
                .orderId(orderId)
                .paymentId(paymentId)
                .note(cleanNote)
                .status(ReportStatus.OPEN)
                .createdAt(new Date())
                .build());
    }

    public boolean orderReported(String userId, String orderId) {
        return reportRepository.existsByTypeAndOrderIdAndReporterId(ReportType.PAYMENT, orderId, userId);
    }

    private boolean isOrderParty(String userId, Order order) {
        if (userId.equals(order.getDeliveryPersonnelId())) return true;
        return shopRepository.findById(order.getShopId())
                .map(s -> userId.equals(s.getOperatorId()))
                .orElse(false);
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
