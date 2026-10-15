package com.campusbrew.campusbrew_api.service;

import com.campusbrew.campusbrew_api.model.AssignmentStatus;
import com.campusbrew.campusbrew_api.model.DeliveryAssignment;
import com.campusbrew.campusbrew_api.model.DeliveryPersonnel;
import com.campusbrew.campusbrew_api.model.Order;
import com.campusbrew.campusbrew_api.model.OrderStatus;
import com.campusbrew.campusbrew_api.model.PaymentMethod;
import com.campusbrew.campusbrew_api.model.Shop;
import com.campusbrew.campusbrew_api.model.User;
import com.campusbrew.campusbrew_api.repository.DeliveryAssignmentRepository;
import com.campusbrew.campusbrew_api.repository.DeliveryPersonnelRepository;
import com.campusbrew.campusbrew_api.repository.OrderRepository;
import com.campusbrew.campusbrew_api.repository.ShopRepository;
import com.campusbrew.campusbrew_api.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.geo.GeoJsonPoint;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Per SDD §3.2 (broadcast-and-claim). When an order reaches READY_FOR_PICKUP the
 * engine broadcasts a {@code delivery:request} offer to every active, idle dasher
 * whose pickup range covers the shop (v2.0 FR-3.2). The first to tap Accept wins
 * via the atomic claim in {@link #claimOrder}; losing DPs receive
 * {@code delivery:claimed} so their modals dismiss.
 *
 * If nobody claims within {@code delivery.offer.rebroadcastSeconds} (60s), the
 * offer is re-broadcast to ALL active dashers regardless of range (see
 * {@link #rebroadcastToAll}, driven by OfferRebroadcastScheduler). The order also
 * stays in the marketplace pool the whole time, so a dasher who missed the push
 * can browse and claim it manually — the atomic claim is the authoritative path.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DeliveryAssignmentEngine {

    private static final double EARTH_RADIUS_M = 6_371_000.0;

    private final MongoTemplate mongoTemplate;
    private final DeliveryAssignmentRepository assignmentRepository;
    private final DeliveryPersonnelRepository deliveryPersonnelRepository;
    private final OrderRepository orderRepository;
    private final ShopRepository shopRepository;
    private final UserRepository userRepository;
    private final SocketService socketService;
    private final ConfigService configService;
    private final PushNotificationService pushNotificationService;

    /**
     * Kick off assignment for an order that just reached READY_FOR_PICKUP. The
     * initial offer is range-filtered (v2.0 FR-3.2). If no eligible dasher is in
     * range, the 60s re-broadcast and the marketplace pull are the fallbacks.
     */
    public void assignOrder(Order order) {
        if (order.getOrderStatus() != OrderStatus.READY_FOR_PICKUP) {
            log.warn("assignOrder called for order {} in status {} — skipping",
                    order.getId(), order.getOrderStatus());
            return;
        }
        Shop shop = shopRepository.findById(order.getShopId()).orElse(null);
        List<DeliveryPersonnel> recipients = findEligibleDps(shop, true);
        if (recipients.isEmpty()) {
            log.info("No in-range active DP for order {} — relying on 60s re-broadcast / marketplace",
                    order.getId());
            return;
        }
        broadcast(order, shop, recipients);
        log.info("Range-filtered offer for order {} sent to {} DP(s)", order.getId(), recipients.size());
    }

    /**
     * v2.0 FR-3.2 — the unclaimed-offer re-broadcast. Sends the offer to ALL active,
     * idle dashers ignoring pickup range, and stamps {@code rebroadcastAt} so it
     * fires exactly once. No-op if the order has since been claimed or moved on.
     */
    public void rebroadcastToAll(Order order) {
        if (order.getOrderStatus() != OrderStatus.READY_FOR_PICKUP
                || order.getDeliveryPersonnelId() != null
                || order.getRebroadcastAt() != null) {
            return;
        }
        Shop shop = shopRepository.findById(order.getShopId()).orElse(null);
        List<DeliveryPersonnel> all = findEligibleDps(shop, false);
        broadcast(order, shop, all);

        order.setRebroadcastAt(Date.from(Instant.now()));
        order.setUpdatedAt(order.getRebroadcastAt());
        orderRepository.save(order);
        log.info("Re-broadcast order {} to all {} active DP(s) (range ignored)", order.getId(), all.size());
    }

    /** Emit a per-dasher offer to each recipient and record a PENDING audit row. */
    private void broadcast(Order order, Shop shop, List<DeliveryPersonnel> recipients) {
        double[] ref = shopReference(shop);
        Map<String, Object> base = baseOfferPayload(order, shop);
        Date now = Date.from(Instant.now());
        for (DeliveryPersonnel dp : recipients) {
            Map<String, Object> payload = new LinkedHashMap<>(base);
            payload.put("distanceMeters", distanceMeters(dp, ref));
            payload.put("earnings", earningsFor(order, dp));
            payload.put("incentiveProgress",
                    dp.getTotalDeliveries() + "/" + configService.getIncentiveThreshold());
            socketService.emitToUser(dp.getUserId(), "delivery:request", payload);
            upsertPendingAssignment(order.getId(), dp.getUserId(), now);
            pushNotificationService.send(dp.getUserId(), "New delivery request",
                    "A new order is available to deliver. Tap to view.",
                    Map.of("orderId", order.getId(), "type", "offer"));
        }
    }

    /**
     * Active + idle dashers. When {@code rangeFiltered} is true, keep only those
     * within their chosen pickup range of the shop reference point. A dasher with
     * no pickup range (campus default) or no known location is always included —
     * this keeps the flow working when GPS is unavailable (e.g. the dev simulator).
     */
    private List<DeliveryPersonnel> findEligibleDps(Shop shop, boolean rangeFiltered) {
        Query q = Query.query(Criteria.where("isActive").is(true)
                .and("currentOrderId").is(null));
        List<DeliveryPersonnel> active = mongoTemplate.find(q, DeliveryPersonnel.class);
        if (!rangeFiltered) {
            return active;
        }
        double[] ref = shopReference(shop);
        return active.stream().filter(dp -> withinRange(dp, ref)).toList();
    }

    public void acceptAssignment(String dpUserId, String orderId) {
        claimOrder(dpUserId, orderId);
    }

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
     * The atomic claim. findAndModify resolves concurrent claims at the storage
     * layer — only the first returns a non-null document; every other claim fails.
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
        pushNotificationService.send(order.getCustomerId(), "Rider assigned",
                (dpName == null ? "A rider" : dpName) + " is picking up your order.",
                Map.of("orderId", orderId, "status", "ASSIGNED"));

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

    // ─── Offer payload ──────────────────────────────────────────────────────

    /** Fields common to every recipient of this order's offer. */
    private Map<String, Object> baseOfferPayload(Order order, Shop shop) {
        Map<String, Object> p = new LinkedHashMap<>();
        boolean cod = order.getPaymentMethod() == PaymentMethod.COD;

        p.put("orderId", order.getId());
        p.put("shopName", shop != null ? shop.getShopName() : null);
        p.put("shopLocation", shop != null ? shop.getLocation() : null);
        p.put("dropoff", order.getDeliveryLocation());
        p.put("itemCount", order.getItems() == null ? 0 : order.getItems().size());
        p.put("beverageCost", order.getBeverageSubtotal());
        // What the dasher collects from the customer: full amount for COD, nothing for GCash.
        p.put("paidViaGcash", !cod);
        p.put("amountToCollect", cod ? order.getTotalAmount() : null);
        p.put("tip", order.getTip());
        p.put("customerRating", customerRating(order.getCustomerId()));
        long seconds = configService.getOfferRebroadcastSeconds();
        p.put("timeoutSeconds", seconds);
        p.put("expiresAt", System.currentTimeMillis() + seconds * 1000L);
        return p;
    }

    /** Customer average rating, shown only once they have enough ratings (FR-3.6). */
    private Double customerRating(String customerId) {
        return userRepository.findById(customerId)
                .filter(u -> u.getRatingCount() >= configService.getRatingMinCountToShow())
                .map(User::getRatingAvg)
                .orElse(null);
    }

    /** The dasher's take for this trip: their current fee rate + the full tip (FR-4.3). */
    private double earningsFor(Order order, DeliveryPersonnel dp) {
        double fee = order.getDeliveryFee();
        double dasherFee = dp.isIncentiveActive()
                ? fee
                : Math.max(fee - order.getPlatformCommission(), 0);
        return round(dasherFee + order.getTip());
    }

    // ─── Geo helpers ────────────────────────────────────────────────────────

    /** Shop reference point [lng, lat]. Shops have no coordinates yet → campus center. */
    private double[] shopReference(Shop shop) {
        return new double[]{configService.getCampusLongitude(), configService.getCampusLatitude()};
    }

    /** True if the dasher's chosen range covers the shop; campus-default / no-GPS always passes. */
    private boolean withinRange(DeliveryPersonnel dp, double[] ref) {
        Integer range = dp.getPickupRangeMeters();
        if (range == null) return true;                 // campus default = no cap
        GeoJsonPoint loc = dp.getCurrentLocation();
        if (loc == null) return true;                    // no GPS → don't exclude
        return haversine(loc.getY(), loc.getX(), ref[1], ref[0]) <= range;
    }

    /** Distance in meters from the dasher to the reference point, or null without GPS. */
    private Double distanceMeters(DeliveryPersonnel dp, double[] ref) {
        GeoJsonPoint loc = dp.getCurrentLocation();
        if (loc == null) return null;
        return round(haversine(loc.getY(), loc.getX(), ref[1], ref[0]));
    }

    private static double haversine(double lat1, double lon1, double lat2, double lon2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    // ─── Internals ──────────────────────────────────────────────────────────

    /** Record a PENDING audit/dismiss row for this (order, dasher) unless one exists. */
    private void upsertPendingAssignment(String orderId, String dpUserId, Date now) {
        boolean exists = assignmentRepository.findByOrderId(orderId).stream()
                .anyMatch(a -> dpUserId.equals(a.getDeliveryPersonnelId())
                        && a.getStatus() == AssignmentStatus.PENDING);
        if (exists) return;
        assignmentRepository.save(DeliveryAssignment.builder()
                .orderId(orderId)
                .deliveryPersonnelId(dpUserId)
                .status(AssignmentStatus.PENDING)
                .assignedAt(now)
                .build());
    }

    private static double round(double v) {
        return Math.round(v * 100.0) / 100.0;
    }

    private String getShopOperatorUserId(String shopId) {
        return shopRepository.findById(shopId).map(Shop::getOperatorId).orElse(null);
    }
}
