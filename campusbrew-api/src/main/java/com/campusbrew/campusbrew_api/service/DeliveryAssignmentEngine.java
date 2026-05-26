package com.campusbrew.campusbrew_api.service;

import com.campusbrew.campusbrew_api.model.AssignmentStatus;
import com.campusbrew.campusbrew_api.model.DeliveryAssignment;
import com.campusbrew.campusbrew_api.model.DeliveryPersonnel;
import com.campusbrew.campusbrew_api.model.Order;
import com.campusbrew.campusbrew_api.model.OrderStatus;
import com.campusbrew.campusbrew_api.model.Shop;
import com.campusbrew.campusbrew_api.model.User;
import com.campusbrew.campusbrew_api.repository.DeliveryAssignmentRepository;
import com.campusbrew.campusbrew_api.repository.DeliveryPersonnelRepository;
import com.campusbrew.campusbrew_api.repository.OrderRepository;
import com.campusbrew.campusbrew_api.repository.ShopRepository;
import com.campusbrew.campusbrew_api.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Date;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Per SDD §3.2 (hybrid model). Broadcasts a `delivery:request` socket event to
 * every active + idle delivery personnel. First DP to tap Accept wins via the
 * atomic claim in {@link #claimOrder}; losing DPs receive `delivery:claimed` so
 * their modals dismiss. Order also stays in the marketplace pool the whole time
 * so DPs who missed the push can browse and claim manually.
 *
 * The push notification is purely a UX nudge — the marketplace fetch + atomic
 * claim are the authoritative paths. This means even when proximity / GPS is
 * unreliable (dev simulator), the flow still works.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DeliveryAssignmentEngine {

    private final MongoTemplate mongoTemplate;
    private final DeliveryAssignmentRepository assignmentRepository;
    private final DeliveryPersonnelRepository deliveryPersonnelRepository;
    private final OrderRepository orderRepository;
    private final ShopRepository shopRepository;
    private final UserRepository userRepository;
    private final SocketService socketService;

    @Value("${delivery.dispatch.timeoutSeconds:30}")
    private long timeoutSeconds;

    /**
     * Kick off assignment for an order that just reached READY_FOR_PICKUP.
     * Returns immediately — broadcasting proceeds synchronously here but is cheap
     * (one socket emit per active DP). Falls back to the marketplace if no DPs
     * are active.
     *
     * Broadcast model: every active, idle DP gets a `delivery:request` event.
     * First DP to tap Accept wins via the atomic claim in {@link #claimOrder}.
     * Losing modals are dismissed via `delivery:claimed`.
     */
    public void assignOrder(Order order) {
        if (order.getOrderStatus() != OrderStatus.READY_FOR_PICKUP) {
            log.warn("assignOrder called for order {} in status {} — skipping",
                    order.getId(), order.getOrderStatus());
            return;
        }

        List<String> recipients = findEligibleDps();
        if (recipients.isEmpty()) {
            log.info("No active delivery personnel to notify for order {} — relying on marketplace",
                    order.getId());
            return;
        }

        Map<String, Object> payload = buildOfferPayload(order.getId());
        for (String dpUserId : recipients) {
            socketService.emitToUser(dpUserId, "delivery:request", payload);
            assignmentRepository.save(DeliveryAssignment.builder()
                    .orderId(order.getId())
                    .deliveryPersonnelId(dpUserId)
                    .status(AssignmentStatus.PENDING)
                    .assignedAt(Date.from(Instant.now()))
                    .build());
        }
        log.info("Broadcast offer for order {} to {} active DP(s)", order.getId(), recipients.size());
    }

    /**
     * Active + idle DPs. Proximity is NOT a gate here — the campus is small enough
     * that every active rider is a valid candidate, and the simulator's GPS often
     * isn't pointing at the actual campus location anyway.
     */
    private List<String> findEligibleDps() {
        Query q = Query.query(Criteria.where("isActive").is(true)
                .and("currentOrderId").is(null));
        return mongoTemplate.find(q, DeliveryPersonnel.class).stream()
                .map(DeliveryPersonnel::getUserId)
                .collect(java.util.stream.Collectors.toList());
    }

    /**
     * Accept path used by both the push offer (modal) and the pull marketplace.
     * Atomic claim — if two DPs race, only the first one wins; the loser sees a
     * helpful "Already claimed" error.
     */
    public void acceptAssignment(String dpUserId, String orderId) {
        claimOrder(dpUserId, orderId);
    }

    /**
     * Decline the push offer. The order stays in READY_FOR_PICKUP — it stays in
     * the marketplace pool and any DP (including this one) can still claim it via
     * the available-deliveries list. Logged as DECLINED for audit purposes.
     */
    public void declineAssignment(String dpUserId, String orderId) {
        assignmentRepository.findByOrderId(orderId).stream()
                .filter(a -> dpUserId.equals(a.getDeliveryPersonnelId())
                        && a.getStatus() == AssignmentStatus.PENDING)
                .findFirst()
                .ifPresent(a -> {
                    a.setStatus(AssignmentStatus.DECLINED);
                    a.setRespondedAt(Date.from(Instant.now()));
                    assignmentRepository.save(a);
                });
        log.info("Order {} declined by DP {} — stays in marketplace", orderId, dpUserId);
    }

    /** Marketplace claim — same code path as the push accept. */
    public void claimFromMarketplace(String dpUserId, String orderId) {
        claimOrder(dpUserId, orderId);
    }

    /**
     * The atomic claim itself. Uses MongoTemplate.findAndModify so two concurrent
     * claims on the same order are resolved at the storage layer — only the first
     * findAndModify returns a non-null document.
     */
    private void claimOrder(String dpUserId, String orderId) {
        DeliveryPersonnel dp = deliveryPersonnelRepository.findByUserId(dpUserId)
                .orElseThrow(() -> new RuntimeException("Delivery profile not found"));
        if (dp.getCurrentOrderId() != null) {
            throw new RuntimeException("You're already on a delivery — finish that one first");
        }

        Date now = Date.from(Instant.now());

        Query claim = Query.query(Criteria.where("_id").is(orderId)
                .and("orderStatus").is(OrderStatus.READY_FOR_PICKUP)
                .and("deliveryPersonnelId").is(null));
        Update update = new Update()
                .set("orderStatus", OrderStatus.ASSIGNED)
                .set("deliveryPersonnelId", dpUserId)
                .set("updatedAt", now)
                .push("statusHistory", com.campusbrew.campusbrew_api.model.StatusHistoryEntry.builder()
                        .status(OrderStatus.ASSIGNED).timestamp(now).build());

        Order order = mongoTemplate.findAndModify(claim, update,
                FindAndModifyOptions.options().returnNew(true), Order.class);
        if (order == null) {
            throw new RuntimeException("This order was already claimed by another rider");
        }

        // Mark DP as busy.
        dp.setCurrentOrderId(orderId);
        dp.setUpdatedAt(now);
        deliveryPersonnelRepository.save(dp);

        // Mark the winner's PENDING audit row as ACCEPTED (if it exists), or write
        // a standalone ACCEPTED row for marketplace claims that bypassed the broadcast.
        assignmentRepository.findByOrderId(orderId).stream()
                .filter(a -> dpUserId.equals(a.getDeliveryPersonnelId())
                        && a.getStatus() == AssignmentStatus.PENDING)
                .findFirst()
                .ifPresentOrElse(
                        a -> {
                            a.setStatus(AssignmentStatus.ACCEPTED);
                            a.setRespondedAt(now);
                            assignmentRepository.save(a);
                        },
                        () -> assignmentRepository.save(DeliveryAssignment.builder()
                                .orderId(orderId)
                                .deliveryPersonnelId(dpUserId)
                                .status(AssignmentStatus.ACCEPTED)
                                .assignedAt(now)
                                .respondedAt(now)
                                .build()));

        String dpName = userRepository.findById(dpUserId).map(User::getFullName).orElse(null);
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("orderId", orderId);
        payload.put("status", OrderStatus.ASSIGNED.name());
        payload.put("deliveryPersonnel",
                Map.of("id", dpUserId, "fullName", dpName == null ? "" : dpName));

        socketService.emitToUser(order.getCustomerId(), "order:assigned", payload);
        socketService.emitToUser(getShopOperatorUserId(order.getShopId()), "order:assigned", payload);
        // Generic statusUpdate so the customer's timeline tails a single event stream.
        socketService.emitToUser(order.getCustomerId(), "order:statusUpdate", payload);
        socketService.emitToOrder(order.getId(), "order:statusUpdate", payload);
        socketService.emitToUser(getShopOperatorUserId(order.getShopId()), "order:statusUpdate", payload);
        socketService.emitToUser(dpUserId, "order:statusUpdate", payload);

        // Tell every other DP that had a pending offer for this order to dismiss their modal.
        Map<String, Object> claimedPayload = Map.of("orderId", orderId);
        assignmentRepository.findByOrderId(orderId).stream()
                .filter(a -> a.getStatus() == AssignmentStatus.PENDING
                        && !dpUserId.equals(a.getDeliveryPersonnelId()))
                .forEach(a -> {
                    socketService.emitToUser(a.getDeliveryPersonnelId(), "delivery:claimed", claimedPayload);
                    a.setStatus(AssignmentStatus.TIMED_OUT); // losing offers — close them out
                    a.setRespondedAt(now);
                    assignmentRepository.save(a);
                });

        log.info("Order {} claimed by DP {}", orderId, dpUserId);
    }

    // ─── Internals ──────────────────────────────────────────────────────────

    private Map<String, Object> buildOfferPayload(String orderId) {
        Map<String, Object> payload = new HashMap<>();
        Order order = orderRepository.findById(orderId).orElse(null);
        if (order == null) return payload;
        Shop shop = shopRepository.findById(order.getShopId()).orElse(null);

        payload.put("orderId", orderId);
        payload.put("shopName", shop != null ? shop.getShopName() : null);
        payload.put("shopLocation", shop != null ? shop.getLocation() : null);
        payload.put("deliveryLocation", order.getDeliveryLocation());
        payload.put("orderAmount", order.getTotalAmount());
        payload.put("itemCount", order.getItems() == null ? 0 : order.getItems().size());
        payload.put("timeoutSeconds", timeoutSeconds);
        return payload;
    }

    private String getShopOperatorUserId(String shopId) {
        return shopRepository.findById(shopId).map(Shop::getOperatorId).orElse(null);
    }
}
