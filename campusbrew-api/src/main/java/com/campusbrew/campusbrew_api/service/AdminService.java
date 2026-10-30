package com.campusbrew.campusbrew_api.service;

import com.campusbrew.campusbrew_api.dto.ReportDTO;
import com.campusbrew.campusbrew_api.model.ChatMessage;
import com.campusbrew.campusbrew_api.model.Order;
import com.campusbrew.campusbrew_api.model.Payment;
import com.campusbrew.campusbrew_api.model.Report;
import com.campusbrew.campusbrew_api.model.ReportStatus;
import com.campusbrew.campusbrew_api.model.ReportType;
import com.campusbrew.campusbrew_api.model.Shop;
import com.campusbrew.campusbrew_api.model.User;
import com.campusbrew.campusbrew_api.model.UserRole;
import com.campusbrew.campusbrew_api.repository.ChatMessageRepository;
import com.campusbrew.campusbrew_api.repository.DeliveryPersonnelRepository;
import com.campusbrew.campusbrew_api.repository.OrderRepository;
import com.campusbrew.campusbrew_api.repository.PaymentRepository;
import com.campusbrew.campusbrew_api.repository.ReportRepository;
import com.campusbrew.campusbrew_api.repository.ShopRepository;
import com.campusbrew.campusbrew_api.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Date;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Admin review of user reports (flagged chats, payment problems) and account
 * suspension. A suspended account can't log in or call the API, and is taken
 * offline as a dasher.
 */
@Service
@RequiredArgsConstructor
public class AdminService {

    private final ReportRepository reportRepository;
    private final ChatMessageRepository chatMessageRepository;
    private final PaymentRepository paymentRepository;
    private final OrderRepository orderRepository;
    private final ShopRepository shopRepository;
    private final UserRepository userRepository;
    private final DeliveryPersonnelRepository deliveryPersonnelRepository;
    private final ChatService chatService;

    /** Open reports, resolved ones, or everything (null), newest first. */
    public List<ReportDTO> reports(ReportStatus status) {
        List<Report> reports = status == null
                ? reportRepository.findAllByOrderByCreatedAtDesc()
                : reportRepository.findByStatusOrderByCreatedAtDesc(status);
        return reports.stream().map(r -> summary(r).build()).toList();
    }

    public ReportDTO report(String id) {
        Report r = requireReport(id);
        ReportDTO.ReportDTOBuilder dto = summary(r);
        Set<String> involved = new LinkedHashSet<>();
        involved.add(r.getReporterId());

        if (r.getType() == ReportType.CHAT) {
            involved.addAll(chatService.participantIds(r.getOrderId(), r.getChannel()));
            List<ChatMessage> messages = chatMessageRepository
                    .findByOrderIdAndChannelOrderByCreatedAtAsc(r.getOrderId(), r.getChannel());
            Map<String, String> names = names(messages.stream().map(ChatMessage::getSenderId).toList());
            dto.messages(messages.stream().map(m -> ReportDTO.Message.builder()
                    .senderName(names.getOrDefault(m.getSenderId(), "CampusBrew user"))
                    .senderRole(m.getSenderRole())
                    .text(m.getText())
                    .createdAt(m.getCreatedAt())
                    .build()).toList());
        } else {
            paymentRepository.findById(r.getPaymentId()).ifPresent(p -> dto.payment(paymentInfo(p)));
            // The order's shop operator and dasher, if it got that far.
            if (r.getOrderId() != null) {
                orderRepository.findById(r.getOrderId()).ifPresent(o -> involved.addAll(orderParties(o)));
            }
        }

        List<ReportDTO.Person> people = new ArrayList<>();
        for (String userId : involved) {
            userRepository.findById(userId).ifPresent(u -> people.add(ReportDTO.Person.builder()
                    .userId(u.getId())
                    .name(u.getFullName())
                    .role(roleLabel(u.getRole()))
                    .reporter(u.getId().equals(r.getReporterId()))
                    .suspended(u.isSuspended())
                    .build()));
        }
        return dto.people(people).build();
    }

    public ReportDTO resolve(String adminId, String id) {
        Report r = requireReport(id);
        if (r.getStatus() != ReportStatus.RESOLVED) {
            r.setStatus(ReportStatus.RESOLVED);
            r.setResolvedBy(adminId);
            r.setResolvedAt(new Date());
            reportRepository.save(r);
        }
        return report(id);
    }

    public void suspend(String adminId, String userId, String reason) {
        User user = requireUser(userId);
        if (user.getRole() == UserRole.ADMIN) {
            throw new IllegalArgumentException("Admin accounts can't be suspended");
        }
        if (userId.equals(adminId)) {
            throw new IllegalArgumentException("You can't suspend yourself");
        }
        user.setSuspended(true);
        user.setSuspendedReason(reason == null || reason.isBlank() ? null : reason.trim());
        user.setSuspendedAt(new Date());
        user.setUpdatedAt(new Date());
        userRepository.save(user);
        // Stop offers reaching a suspended dasher.
        deliveryPersonnelRepository.findByUserId(userId).ifPresent(dp -> {
            dp.setActive(false);
            dp.setUpdatedAt(new Date());
            deliveryPersonnelRepository.save(dp);
        });
    }

    public void unsuspend(String userId) {
        User user = requireUser(userId);
        user.setSuspended(false);
        user.setSuspendedReason(null);
        user.setSuspendedAt(null);
        user.setUpdatedAt(new Date());
        userRepository.save(user);
    }

    // ─── Helpers ────────────────────────────────────────────────

    private ReportDTO.ReportDTOBuilder summary(Report r) {
        String reporter = r.getReporterId() == null ? null
                : userRepository.findById(r.getReporterId()).map(User::getFullName).orElse(null);
        return ReportDTO.builder()
                .id(r.getId())
                .type(r.getType())
                .status(r.getStatus())
                .createdAt(r.getCreatedAt())
                .resolvedAt(r.getResolvedAt())
                .reporterId(r.getReporterId())
                .reporterName(reporter)
                .orderId(r.getOrderId())
                .channel(r.getChannel())
                .paymentId(r.getPaymentId())
                .note(r.getNote());
    }

    private List<String> orderParties(Order o) {
        List<String> ids = new ArrayList<>();
        ids.add(o.getCustomerId());
        shopRepository.findById(o.getShopId()).map(Shop::getOperatorId).ifPresent(ids::add);
        if (o.getDeliveryPersonnelId() != null) ids.add(o.getDeliveryPersonnelId());
        return ids;
    }

    private Map<String, String> names(List<String> userIds) {
        return userRepository.findAllById(new LinkedHashSet<>(userIds)).stream()
                .collect(Collectors.toMap(User::getId, User::getFullName, (a, b) -> a));
    }

    private static ReportDTO.PaymentInfo paymentInfo(Payment p) {
        Function<Object, String> name = v -> v == null ? null : v.toString();
        return ReportDTO.PaymentInfo.builder()
                .amount(p.getAmount())
                .type(name.apply(p.getType()))
                .method(name.apply(p.getMethod()))
                .status(name.apply(p.getStatus()))
                .referenceNo(p.getReferenceNo())
                .createdAt(p.getCreatedAt())
                .build();
    }

    private static String roleLabel(UserRole role) {
        if (role == null) return "User";
        return switch (role) {
            case CUSTOMER -> "Customer";
            case DELIVERY_PERSONNEL -> "Dasher";
            case SHOP_OPERATOR -> "Shop";
            case ADMIN -> "Admin";
        };
    }

    private Report requireReport(String id) {
        return reportRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Report not found"));
    }

    private User requireUser(String userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
    }
}
