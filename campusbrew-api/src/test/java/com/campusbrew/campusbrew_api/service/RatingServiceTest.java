package com.campusbrew.campusbrew_api.service;

import com.campusbrew.campusbrew_api.dto.RatingFormDTO;
import com.campusbrew.campusbrew_api.dto.RatingTargetDTO;
import com.campusbrew.campusbrew_api.dto.SubmitRatingsDTO;
import com.campusbrew.campusbrew_api.model.DeliveryPersonnel;
import com.campusbrew.campusbrew_api.model.Order;
import com.campusbrew.campusbrew_api.model.OrderStatus;
import com.campusbrew.campusbrew_api.model.Rating;
import com.campusbrew.campusbrew_api.model.Shop;
import com.campusbrew.campusbrew_api.model.StatusHistoryEntry;
import com.campusbrew.campusbrew_api.model.User;
import com.campusbrew.campusbrew_api.repository.DeliveryPersonnelRepository;
import com.campusbrew.campusbrew_api.repository.OrderRepository;
import com.campusbrew.campusbrew_api.repository.RatingRepository;
import com.campusbrew.campusbrew_api.repository.ShopRepository;
import com.campusbrew.campusbrew_api.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** v2.0 FR-3.6 — who rates whom, the 24h window, upsert, moderation and averages. */
class RatingServiceTest {

    private RatingRepository ratingRepo;
    private OrderRepository orderRepo;
    private ShopRepository shopRepo;
    private UserRepository userRepo;
    private DeliveryPersonnelRepository dpRepo;
    private RatingService service;

    private Shop shop;
    private User dasherUser;
    private DeliveryPersonnel dp;

    @BeforeEach
    void setUp() {
        ratingRepo = mock(RatingRepository.class);
        orderRepo = mock(OrderRepository.class);
        shopRepo = mock(ShopRepository.class);
        userRepo = mock(UserRepository.class);
        dpRepo = mock(DeliveryPersonnelRepository.class);
        ConfigService config = mock(ConfigService.class);
        when(config.getRatingWindowHours()).thenReturn(24);

        shop = Shop.builder().id("s1").operatorId("op1").shopName("Brew Central").build();
        dasherUser = User.builder().id("d1").fullName("Mark").build();
        dp = DeliveryPersonnel.builder().id("dp-doc").userId("d1").build();
        when(shopRepo.findById("s1")).thenReturn(Optional.of(shop));
        when(userRepo.findById("d1")).thenReturn(Optional.of(dasherUser));
        when(userRepo.findById("c1")).thenReturn(Optional.of(User.builder().id("c1").fullName("Juan").build()));
        when(dpRepo.findByUserId("d1")).thenReturn(Optional.of(dp));
        when(ratingRepo.findByOrderIdAndRaterIdAndRateeId(anyString(), anyString(), anyString()))
                .thenReturn(Optional.empty());
        when(ratingRepo.findByOrderIdAndRaterId(anyString(), anyString())).thenReturn(List.of());
        when(ratingRepo.findByRateeIdAndRateeRole(anyString(), anyString())).thenReturn(List.of());

        service = new RatingService(ratingRepo, orderRepo, shopRepo, userRepo, dpRepo, config, new ModerationFilter());
    }

    private void order(OrderStatus status, Instant at) {
        Order o = Order.builder().id("o1").customerId("c1").shopId("s1").deliveryPersonnelId("d1")
                .orderStatus(status)
                .statusHistory(List.of(StatusHistoryEntry.builder().status(status).timestamp(Date.from(at)).build()))
                .build();
        when(orderRepo.findById("o1")).thenReturn(Optional.of(o));
    }

    private static SubmitRatingsDTO ratings(SubmitRatingsDTO.Entry... entries) {
        return new SubmitRatingsDTO(List.of(entries));
    }

    private static List<String> roles(RatingFormDTO f) {
        return f.getTargets().stream().map(RatingTargetDTO::getRateeRole).toList();
    }

    @Test
    void eachPartyGetsTheRightTargets() {
        order(OrderStatus.DELIVERED, Instant.now());

        assertThat(roles(service.form("c1", "o1"))).containsExactly("SHOP", "DELIVERY_PERSONNEL");
        assertThat(roles(service.form("d1", "o1"))).containsExactly("CUSTOMER", "SHOP");
        assertThat(roles(service.form("op1", "o1"))).containsExactly("DELIVERY_PERSONNEL");

        RatingFormDTO customer = service.form("c1", "o1");
        assertThat(customer.isWindowOpen()).isTrue();
        assertThat(customer.getTargets().get(0).getName()).isEqualTo("Brew Central");
        assertThat(customer.getTargets().get(0).isAllowReview()).isTrue();
        assertThat(customer.getTargets().get(1).isAllowReview()).isFalse();
    }

    @Test
    void outsidersCannotRate() {
        order(OrderStatus.DELIVERED, Instant.now());
        assertThatThrownBy(() -> service.form("stranger", "o1")).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void customerRatingUpdatesShopAndDasherAverages() {
        order(OrderStatus.DELIVERED, Instant.now());
        when(ratingRepo.findByRateeIdAndRateeRole("s1", "SHOP")).thenReturn(List.of(
                Rating.builder().stars(4).build(), Rating.builder().stars(5).build()));
        when(ratingRepo.findByRateeIdAndRateeRole("d1", "DELIVERY_PERSONNEL")).thenReturn(List.of(
                Rating.builder().stars(5).build(), Rating.builder().stars(4).build(), Rating.builder().stars(4).build()));

        service.submit("c1", "o1", ratings(
                new SubmitRatingsDTO.Entry("SHOP", 4, List.of("Tasty"), "Great latte"),
                new SubmitRatingsDTO.Entry("DELIVERY_PERSONNEL", 5, List.of("Fast", "Friendly"), null)));

        ArgumentCaptor<Rating> saved = ArgumentCaptor.forClass(Rating.class);
        verify(ratingRepo, times(2)).save(saved.capture());
        Rating shopRating = saved.getAllValues().get(0);
        assertThat(shopRating.getRateeId()).isEqualTo("s1");
        assertThat(shopRating.getRaterRole()).isEqualTo("CUSTOMER");
        assertThat(shopRating.getReview()).isEqualTo("Great latte");
        assertThat(shopRating.isHidden()).isFalse();

        assertThat(shop.getRatingAvg()).isEqualTo(4.5);
        assertThat(shop.getRatingCount()).isEqualTo(2);
        assertThat(dasherUser.getRatingAvg()).isEqualTo(4.33);
        assertThat(dp.getRatingCount()).isEqualTo(3);
    }

    @Test
    void ratingAgainEditsTheExistingRating() {
        order(OrderStatus.DELIVERED, Instant.now());
        Rating existing = Rating.builder().id("r1").orderId("o1").raterId("op1").rateeId("d1")
                .rateeRole("DELIVERY_PERSONNEL").stars(2).build();
        when(ratingRepo.findByOrderIdAndRaterIdAndRateeId("o1", "op1", "d1")).thenReturn(Optional.of(existing));

        service.submit("op1", "o1", ratings(new SubmitRatingsDTO.Entry("DELIVERY_PERSONNEL", 5, List.of("Polite"), null)));

        verify(ratingRepo).save(existing);
        assertThat(existing.getId()).isEqualTo("r1");
        assertThat(existing.getStars()).isEqualTo(5);
    }

    @Test
    void windowClosesAfter24Hours() {
        order(OrderStatus.DELIVERED, Instant.now().minus(25, ChronoUnit.HOURS));

        assertThat(service.form("c1", "o1").isWindowOpen()).isFalse();
        assertThatThrownBy(() -> service.submit("c1", "o1",
                ratings(new SubmitRatingsDTO.Entry("SHOP", 5, null, null))))
                .isInstanceOf(IllegalStateException.class);
        verify(ratingRepo, never()).save(any());
    }

    @Test
    void undeliveredOrdersCannotBeRated() {
        order(OrderStatus.OUT_FOR_DELIVERY, Instant.now());
        assertThatThrownBy(() -> service.submit("c1", "o1",
                ratings(new SubmitRatingsDTO.Entry("SHOP", 5, null, null))))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void invalidRatingsAreRejected() {
        order(OrderStatus.DELIVERED, Instant.now());

        assertThatThrownBy(() -> service.submit("c1", "o1",
                ratings(new SubmitRatingsDTO.Entry("SHOP", 6, null, null))))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.submit("c1", "o1",
                ratings(new SubmitRatingsDTO.Entry("SHOP", 4, List.of("Made up"), null))))
                .isInstanceOf(IllegalArgumentException.class);
        // A shop can't rate the customer.
        assertThatThrownBy(() -> service.submit("op1", "o1",
                ratings(new SubmitRatingsDTO.Entry("CUSTOMER", 4, null, null))))
                .isInstanceOf(IllegalArgumentException.class);
        verify(ratingRepo, never()).save(any());
    }

    @Test
    void offensiveReviewIsHiddenButStillCounted() {
        order(OrderStatus.DELIVERED, Instant.now());

        service.submit("c1", "o1", ratings(new SubmitRatingsDTO.Entry("SHOP", 1, null, "Putang ina, so slow")));

        ArgumentCaptor<Rating> saved = ArgumentCaptor.forClass(Rating.class);
        verify(ratingRepo).save(saved.capture());
        assertThat(saved.getValue().isHidden()).isTrue();
        assertThat(saved.getValue().getStars()).isEqualTo(1);
    }

    @Test
    void reviewIsDroppedWhereNotAllowed() {
        order(OrderStatus.DELIVERED, Instant.now());

        service.submit("d1", "o1", ratings(new SubmitRatingsDTO.Entry("CUSTOMER", 5, List.of("On time"), "nice")));

        ArgumentCaptor<Rating> saved = ArgumentCaptor.forClass(Rating.class);
        verify(ratingRepo).save(saved.capture());
        assertThat(saved.getValue().getReview()).isNull();
    }

    @Test
    void moderationMatchesWholeWordsOnly() {
        ModerationFilter filter = new ModerationFilter();
        assertThat(filter.isOffensive("You're so tanga")).isTrue();
        assertThat(filter.isOffensive("Bobo!")).isTrue();
        assertThat(filter.isOffensive("Loved the leche flan latte")).isFalse();
        assertThat(filter.isOffensive("Shitake? no, matcha")).isFalse();
        assertThat(filter.isOffensive(null)).isFalse();
    }
}
