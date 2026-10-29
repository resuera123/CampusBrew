package com.campusbrew.campusbrew_api.service;

import com.campusbrew.campusbrew_api.dto.RatingFormDTO;
import com.campusbrew.campusbrew_api.dto.RatingTargetDTO;
import com.campusbrew.campusbrew_api.dto.SubmitRatingsDTO;
import com.campusbrew.campusbrew_api.model.Order;
import com.campusbrew.campusbrew_api.model.OrderStatus;
import com.campusbrew.campusbrew_api.model.Rating;
import com.campusbrew.campusbrew_api.model.Shop;
import com.campusbrew.campusbrew_api.model.User;
import com.campusbrew.campusbrew_api.repository.DeliveryPersonnelRepository;
import com.campusbrew.campusbrew_api.repository.OrderRepository;
import com.campusbrew.campusbrew_api.repository.RatingRepository;
import com.campusbrew.campusbrew_api.repository.ShopRepository;
import com.campusbrew.campusbrew_api.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * v2.0 FR-3.6 — three-way rating after delivery.
 *
 * Who rates whom is decided by the caller's relationship to the order (not the JWT
 * role): the customer rates the shop and the dasher, the dasher rates the customer
 * and the shop, and the shop operator rates the dasher. Clients name the ratee by
 * role; the id is resolved here, so a client can't rate an arbitrary user.
 *
 * One rating per (order, rater, ratee), editable until {@code rating.windowHours}
 * after delivery. Every save recomputes the ratee's average on Shop, User and (for
 * dashers) DeliveryPersonnel. Reviews with blocked words are kept but hidden.
 */
@Service
@RequiredArgsConstructor
public class RatingService {

    static final String CUSTOMER = "CUSTOMER";
    static final String DASHER = "DELIVERY_PERSONNEL";
    static final String SHOP = "SHOP";
    static final String SHOP_OPERATOR = "SHOP_OPERATOR";

    static final int MAX_REVIEW_LENGTH = 300;

    /** Tag choices per (rater role, ratee role), per SRS 3.6 and WF-3.6. */
    private static final Map<String, List<String>> TAG_OPTIONS = Map.of(
            CUSTOMER + ">" + SHOP, List.of("Tasty", "Order accurate", "Quick prep"),
            CUSTOMER + ">" + DASHER, List.of("Fast", "Friendly", "Careful"),
            DASHER + ">" + CUSTOMER, List.of("On time", "Payment ready", "Easy to find"),
            DASHER + ">" + SHOP, List.of("Quick prep", "Order accurate", "Long wait"),
            SHOP_OPERATOR + ">" + DASHER, List.of("On-time pickup", "Paid correctly", "Polite"));

    private final RatingRepository ratingRepository;
    private final OrderRepository orderRepository;
    private final ShopRepository shopRepository;
    private final UserRepository userRepository;
    private final DeliveryPersonnelRepository deliveryPersonnelRepository;
    private final ConfigService configService;
    private final ModerationFilter moderationFilter;

    public RatingFormDTO form(String userId, String orderId) {
        Order order = requireOrder(orderId);
        String raterRole = raterRole(order, userId);
        Map<String, Rating> mine = ratingRepository.findByOrderIdAndRaterId(orderId, userId).stream()
                .collect(Collectors.toMap(Rating::getRateeRole, Function.identity(), (a, b) -> a));

        List<RatingTargetDTO> targets = new ArrayList<>();
        for (String rateeRole : rateeRoles(raterRole)) {
            Rating existing = mine.get(rateeRole);
            targets.add(RatingTargetDTO.builder()
                    .rateeRole(rateeRole)
                    .name(rateeName(order, rateeRole))
                    .tagOptions(TAG_OPTIONS.get(raterRole + ">" + rateeRole))
                    .allowReview(allowReview(raterRole, rateeRole))
                    .stars(existing == null ? null : existing.getStars())
                    .tags(existing == null ? null : existing.getTags())
                    .review(existing == null ? null : existing.getReview())
                    .build());
        }

        Date closesAt = closesAt(order);
        return RatingFormDTO.builder()
                .orderId(orderId)
                .windowOpen(closesAt != null && Instant.now().isBefore(closesAt.toInstant()))
                .closesAt(closesAt)
                .targets(targets)
                .build();
    }

    public RatingFormDTO submit(String userId, String orderId, SubmitRatingsDTO dto) {
        Order order = requireOrder(orderId);
        String raterRole = raterRole(order, userId);
        Date closesAt = closesAt(order);
        if (closesAt == null) {
            throw new IllegalStateException("Orders can be rated once they are delivered");
        }
        if (!Instant.now().isBefore(closesAt.toInstant())) {
            throw new IllegalStateException("The rating window for this order has closed");
        }
        if (dto == null || dto.getRatings() == null || dto.getRatings().isEmpty()) {
            throw new IllegalArgumentException("Nothing to rate");
        }

        List<String> allowed = rateeRoles(raterRole);
        Date now = new Date();
        for (SubmitRatingsDTO.Entry entry : dto.getRatings()) {
            String rateeRole = entry.getRateeRole();
            if (!allowed.contains(rateeRole)) {
                throw new IllegalArgumentException("You can't rate " + rateeRole + " on this order");
            }
            validate(raterRole, rateeRole, entry);

            String rateeId = rateeId(order, rateeRole);
            String review = allowReview(raterRole, rateeRole) ? blankToNull(entry.getReview()) : null;
            Rating rating = ratingRepository.findByOrderIdAndRaterIdAndRateeId(orderId, userId, rateeId)
                    .orElseGet(() -> Rating.builder()
                            .orderId(orderId)
                            .raterId(userId)
                            .raterRole(raterRole)
                            .rateeId(rateeId)
                            .rateeRole(rateeRole)
                            .createdAt(now)
                            .build());
            rating.setStars(entry.getStars());
            rating.setTags(entry.getTags() == null ? List.of() : List.copyOf(new HashSet<>(entry.getTags())));
            rating.setReview(review);
            rating.setHidden(moderationFilter.isOffensive(review));
            rating.setUpdatedAt(now);
            ratingRepository.save(rating);

            recomputeAverage(rateeId, rateeRole);
        }
        return form(userId, orderId);
    }

    private void validate(String raterRole, String rateeRole, SubmitRatingsDTO.Entry entry) {
        if (entry.getStars() < 1 || entry.getStars() > 5) {
            throw new IllegalArgumentException("Stars must be between 1 and 5");
        }
        List<String> options = TAG_OPTIONS.get(raterRole + ">" + rateeRole);
        if (entry.getTags() != null && !options.containsAll(entry.getTags())) {
            throw new IllegalArgumentException("Unknown tag");
        }
        if (entry.getReview() != null && entry.getReview().trim().length() > MAX_REVIEW_LENGTH) {
            throw new IllegalArgumentException("Review is too long (max " + MAX_REVIEW_LENGTH + " characters)");
        }
    }

    /** Average over every rating the ratee has received in this role, rounded to 2 dp. */
    private void recomputeAverage(String rateeId, String rateeRole) {
        List<Rating> all = ratingRepository.findByRateeIdAndRateeRole(rateeId, rateeRole);
        int count = all.size();
        double avg = count == 0 ? 0 : Math.round(
                all.stream().mapToInt(Rating::getStars).average().orElse(0) * 100) / 100.0;

        if (SHOP.equals(rateeRole)) {
            shopRepository.findById(rateeId).ifPresent(s -> {
                s.setRatingAvg(avg);
                s.setRatingCount(count);
                shopRepository.save(s);
            });
            return;
        }
        userRepository.findById(rateeId).ifPresent(u -> {
            u.setRatingAvg(avg);
            u.setRatingCount(count);
            userRepository.save(u);
        });
        if (DASHER.equals(rateeRole)) {
            deliveryPersonnelRepository.findByUserId(rateeId).ifPresent(dp -> {
                dp.setRatingAvg(avg);
                dp.setRatingCount(count);
                deliveryPersonnelRepository.save(dp);
            });
        }
    }

    /** The caller's part in this order; anyone else may not rate it. */
    private String raterRole(Order order, String userId) {
        if (userId == null) throw new IllegalArgumentException("Not signed in");
        if (userId.equals(order.getCustomerId())) return CUSTOMER;
        if (userId.equals(order.getDeliveryPersonnelId())) return DASHER;
        if (userId.equals(shop(order).map(Shop::getOperatorId).orElse(null))) return SHOP_OPERATOR;
        throw new IllegalArgumentException("You are not part of this order");
    }

    private static List<String> rateeRoles(String raterRole) {
        return switch (raterRole) {
            case CUSTOMER -> List.of(SHOP, DASHER);
            case DASHER -> List.of(CUSTOMER, SHOP);
            default -> List.of(DASHER);
        };
    }

    /** Written reviews only for customers rating the shop (WF-3.6); everything else is stars + tags. */
    private static boolean allowReview(String raterRole, String rateeRole) {
        return CUSTOMER.equals(raterRole) && SHOP.equals(rateeRole);
    }

    private String rateeId(Order order, String rateeRole) {
        return switch (rateeRole) {
            case SHOP -> order.getShopId();
            case DASHER -> order.getDeliveryPersonnelId();
            default -> order.getCustomerId();
        };
    }

    private String rateeName(Order order, String rateeRole) {
        if (SHOP.equals(rateeRole)) {
            return shop(order).map(Shop::getShopName).orElse("Shop");
        }
        return userRepository.findById(rateeId(order, rateeRole)).map(User::getFullName)
                .orElse(DASHER.equals(rateeRole) ? "Dasher" : "Customer");
    }

    /** When the rating window closes, or null if the order isn't delivered. */
    private Date closesAt(Order order) {
        if (order.getOrderStatus() != OrderStatus.DELIVERED) return null;
        Date deliveredAt = order.reachedAt(OrderStatus.DELIVERED);
        if (deliveredAt == null) return null;
        return Date.from(deliveredAt.toInstant().plus(Duration.ofHours(configService.getRatingWindowHours())));
    }

    private Optional<Shop> shop(Order order) {
        return shopRepository.findById(order.getShopId());
    }

    private Order requireOrder(String orderId) {
        return orderRepository.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Order not found"));
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
