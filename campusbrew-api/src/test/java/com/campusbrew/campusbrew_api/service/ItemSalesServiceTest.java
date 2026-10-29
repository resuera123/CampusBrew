package com.campusbrew.campusbrew_api.service;

import com.campusbrew.campusbrew_api.dto.ItemSalesDTO;
import com.campusbrew.campusbrew_api.dto.ItemTrendDTO;
import com.campusbrew.campusbrew_api.dto.SalesChartDTO;
import com.campusbrew.campusbrew_api.model.ItemSale;
import com.campusbrew.campusbrew_api.model.MenuItem;
import com.campusbrew.campusbrew_api.model.Order;
import com.campusbrew.campusbrew_api.model.OrderItem;
import com.campusbrew.campusbrew_api.model.Shop;
import com.campusbrew.campusbrew_api.model.User;
import com.campusbrew.campusbrew_api.model.UserRole;
import com.campusbrew.campusbrew_api.repository.ItemSaleRepository;
import com.campusbrew.campusbrew_api.repository.MenuItemRepository;
import com.campusbrew.campusbrew_api.repository.ShopRepository;
import com.campusbrew.campusbrew_api.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** v2.0 FR-5.5 — units sold per item: recording, the list, item trends and the dashboard chart. */
class ItemSalesServiceTest {

    private ItemSalesService service;
    private final Map<String, MenuItem> menu = new LinkedHashMap<>();
    private final List<ItemSale> ledger = new ArrayList<>();

    @BeforeEach
    void setUp() {
        ItemSaleRepository saleRepo = mock(ItemSaleRepository.class);
        MenuItemRepository menuRepo = mock(MenuItemRepository.class);
        ShopRepository shopRepo = mock(ShopRepository.class);
        UserRepository userRepo = mock(UserRepository.class);

        Shop shop = Shop.builder().id("s1").operatorId("op1").build();
        when(shopRepo.findByOperatorId("op1")).thenReturn(List.of(shop));
        when(userRepo.findById("op1")).thenReturn(Optional.of(User.builder().id("op1").role(UserRole.SHOP_OPERATOR).build()));
        when(userRepo.findById("op2")).thenReturn(Optional.of(User.builder().id("op2").role(UserRole.SHOP_OPERATOR).build()));
        when(shopRepo.findByOperatorId("op2")).thenReturn(List.of(Shop.builder().id("s2").operatorId("op2").build()));

        menu.clear();
        ledger.clear();
        when(menuRepo.findById(anyString())).thenAnswer(inv -> Optional.ofNullable(menu.get(inv.getArgument(0))));
        when(menuRepo.findByShopIdOrderByCategory("s1")).thenAnswer(inv -> new ArrayList<>(menu.values()));
        when(saleRepo.saveAll(anyIterable())).thenAnswer(inv -> {
            List<ItemSale> saved = new ArrayList<>();
            ((Iterable<?>) inv.getArgument(0)).forEach(s -> saved.add((ItemSale) s));
            ledger.addAll(saved);
            return saved;
        });
        when(saleRepo.findByShopIdAndCreatedAtGreaterThanEqual(anyString(), any())).thenAnswer(inv -> ledger.stream()
                .filter(s -> s.getShopId().equals(inv.getArgument(0)) && !s.getCreatedAt().before(inv.getArgument(1)))
                .toList());

        service = new ItemSalesService(saleRepo, menuRepo, shopRepo, userRepo);
    }

    private void item(String id, String name) {
        menu.put(id, MenuItem.builder().id(id).shopId("s1").name(name).isAvailable(true).build());
    }

    private void sale(String itemId, String name, int qty, LocalDate day) {
        ledger.add(ItemSale.builder().shopId("s1").itemId(itemId).itemName(name).qty(qty)
                .createdAt(Date.from(day.atTime(12, 0).atZone(ItemSalesService.CAMPUS_ZONE).toInstant()))
                .build());
    }

    private static LocalDate today() {
        return LocalDate.now(ItemSalesService.CAMPUS_ZONE);
    }

    private static LocalDate thisMonday() {
        return today().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
    }

    @Test
    void deliveredOrderRecordsUnitsPerItemWithDuplicateLinesMerged() {
        Order order = Order.builder().id("o1").shopId("s1").items(List.of(
                OrderItem.builder().menuItemId("latte").itemName("Iced Latte").quantity(2).build(),
                OrderItem.builder().menuItemId("tea").itemName("Milk Tea").quantity(1).build(),
                OrderItem.builder().menuItemId("latte").itemName("Iced Latte").quantity(1).build())).build();

        service.recordSale(order);

        assertThat(ledger).hasSize(2);
        ItemSale latte = ledger.stream().filter(s -> s.getItemId().equals("latte")).findFirst().orElseThrow();
        assertThat(latte.getQty()).isEqualTo(3);
        assertThat(latte.getItemName()).isEqualTo("Iced Latte");
        assertThat(latte.getOrderId()).isEqualTo("o1");
    }

    @Test
    void listShowsUnitsSoldTodayOrThisWeekBestSellerFirst() {
        item("latte", "Iced Latte");
        item("tea", "Milk Tea");
        sale("latte", "Iced Latte", 4, today());
        sale("tea", "Milk Tea", 2, thisMonday().minusDays(1)); // last week — never counted
        if (!thisMonday().equals(today())) sale("tea", "Milk Tea", 3, thisMonday());

        List<ItemSalesDTO> todayList = service.list("op1", "today");
        assertThat(todayList.get(0).getName()).isEqualTo("Iced Latte");
        assertThat(todayList.get(0).getUnitsSold()).isEqualTo(4);

        int teaWeek = service.list("op1", "week").stream()
                .filter(i -> i.getItemId().equals("tea")).findFirst().orElseThrow().getUnitsSold();
        assertThat(teaWeek).isEqualTo(thisMonday().equals(today()) ? 0 : 3);
    }

    @Test
    void trendGivesDailyBarsWeekOnWeekChangeAndSellers() {
        item("latte", "Iced Latte");
        item("tea", "Milk Tea");
        item("mocha", "Mocha");
        sale("latte", "Iced Latte", 6, thisMonday());
        sale("latte", "Iced Latte", 4, thisMonday().minusWeeks(1));
        sale("tea", "Milk Tea", 2, thisMonday());

        ItemTrendDTO trend = service.trend("op1", "latte", "daily");

        assertThat(trend.getPoints()).hasSize(7);
        assertThat(trend.getPoints().get(0).getLabel()).isEqualTo("Mon");
        assertThat(trend.getPoints().get(0).getUnits()).isEqualTo(6);
        assertThat(trend.getThisWeek()).isEqualTo(6);
        assertThat(trend.getLastWeek()).isEqualTo(4);
        assertThat(trend.getChangePct()).isEqualTo(50.0);
        assertThat(trend.getBestSellers()).containsExactly("Iced Latte", "Milk Tea");
        assertThat(trend.getSlowest()).containsExactly("Mocha");
        assertThat(service.trend("op1", "latte", "weekly").getPoints()).hasSize(8);
    }

    @Test
    void chartHasOneSeriesPerItemAlignedToTheLast7Days() {
        item("latte", "Iced Latte");
        item("tea", "Milk Tea");
        sale("latte", "Iced Latte", 5, today());
        sale("latte", "Iced Latte", 2, today().minusDays(6));
        sale("latte", "Iced Latte", 9, today().minusDays(7)); // outside the window
        sale("gone", "Old Brew", 1, today());                 // removed from the menu

        SalesChartDTO chart = service.chart("op1", "7d");

        assertThat(chart.getLabels()).hasSize(7);
        assertThat(chart.getSeries()).extracting(SalesChartDTO.Series::getName)
                .containsExactly("Iced Latte", "Old Brew", "Milk Tea"); // best seller first
        SalesChartDTO.Series latte = chart.getSeries().get(0);
        assertThat(latte.getUnits()).hasSize(7);
        assertThat(latte.getUnits().get(0)).isEqualTo(2);
        assertThat(latte.getUnits().get(6)).isEqualTo(5);
        assertThat(latte.getTotal()).isEqualTo(7);
        assertThat(chart.getSeries().get(2).getTotal()).isZero(); // unsold items still toggleable
    }

    @Test
    void chartCanShowTheLast4WeeksPerWeek() {
        item("latte", "Iced Latte");
        sale("latte", "Iced Latte", 3, thisMonday());
        sale("latte", "Iced Latte", 4, thisMonday().minusWeeks(3));

        SalesChartDTO chart = service.chart("op1", "4w");

        assertThat(chart.getRange()).isEqualTo("4w");
        assertThat(chart.getLabels()).hasSize(4);
        assertThat(chart.getSeries().get(0).getUnits()).containsExactly(4, 0, 0, 3);
    }

    @Test
    void onlyTheShopsOwnOperatorCanSeeIt() {
        item("latte", "Iced Latte");
        assertThatThrownBy(() -> service.trend("op2", "latte", "daily")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.chart("someone", "7d")).isInstanceOf(IllegalArgumentException.class);
    }
}
