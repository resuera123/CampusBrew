package com.campusbrew.campusbrew_api.service;

import com.campusbrew.campusbrew_api.dto.ShopDTO;
import com.campusbrew.campusbrew_api.model.Shop;
import com.campusbrew.campusbrew_api.repository.MenuItemRepository;
import com.campusbrew.campusbrew_api.repository.OrderRepository;
import com.campusbrew.campusbrew_api.repository.ShopRepository;
import com.campusbrew.campusbrew_api.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

/** v2.0 FR-2.1 — shop averages hidden below the minimum count, and sort=rating / name. */
class ShopRatingDisplayTest {

    private ShopRepository shopRepo;
    private ShopService service;

    @BeforeEach
    void setUp() {
        shopRepo = mock(ShopRepository.class);
        ConfigService config = mock(ConfigService.class);
        when(config.getRatingMinCountToShow()).thenReturn(3);
        service = new ShopService(shopRepo, mock(MenuItemRepository.class), mock(UserRepository.class),
                mock(OrderRepository.class), config);

        when(shopRepo.findAll()).thenReturn(List.of(
                shop("a", "Zed Tea", 4.2, 10),
                shop("b", "Brew Central", 4.8, 3),
                shop("c", "Alpha Coffee", 5.0, 2),   // too few ratings to show
                shop("d", "Mocha Hub", 4.8, 20)));
    }

    private static Shop shop(String id, String name, double avg, int count) {
        return Shop.builder().id(id).shopName(name).ratingAvg(avg).ratingCount(count).build();
    }

    private static List<String> ids(List<ShopDTO> shops) {
        return shops.stream().map(ShopDTO::getId).toList();
    }

    @Test
    void averageHiddenUntilMinimumCount() {
        List<ShopDTO> shops = service.getAllShops(null);
        ShopDTO alpha = shops.stream().filter(s -> s.getId().equals("c")).findFirst().orElseThrow();
        ShopDTO brew = shops.stream().filter(s -> s.getId().equals("b")).findFirst().orElseThrow();

        assertThat(alpha.getRatingAvg()).isNull();
        assertThat(alpha.getRatingCount()).isEqualTo(2);
        assertThat(brew.getRatingAvg()).isEqualTo(4.8);
    }

    @Test
    void sortByRatingPutsRatedShopsFirstThenMostRatings() {
        // 4.8 with 20 ratings beats 4.8 with 3; hidden averages go last.
        assertThat(ids(service.getAllShops("rating"))).containsExactly("d", "b", "a", "c");
    }

    @Test
    void sortByName() {
        assertThat(ids(service.getAllShops("name"))).containsExactly("c", "b", "d", "a");
    }

    @Test
    void noSortKeepsStoredOrder() {
        assertThat(ids(service.getAllShops(null))).containsExactly("a", "b", "c", "d");
    }

    @Test
    void displayRule() {
        assertThat(RatingDisplay.visible(4.5, 3, 3)).isEqualTo(4.5);
        assertThat(RatingDisplay.visible(4.5, 2, 3)).isNull();
        assertThat(RatingDisplay.visible(0, 0, 0)).isNull();
    }
}
