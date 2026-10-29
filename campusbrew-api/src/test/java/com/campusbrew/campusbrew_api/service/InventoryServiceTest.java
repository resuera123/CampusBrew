package com.campusbrew.campusbrew_api.service;

import com.campusbrew.campusbrew_api.dto.InventoryItemDTO;
import com.campusbrew.campusbrew_api.dto.InventoryTrendDTO;
import com.campusbrew.campusbrew_api.dto.StockTrackingDTO;
import com.campusbrew.campusbrew_api.model.InventoryMovement;
import com.campusbrew.campusbrew_api.model.InventoryMovementType;
import com.campusbrew.campusbrew_api.model.MenuItem;
import com.campusbrew.campusbrew_api.model.Order;
import com.campusbrew.campusbrew_api.model.OrderItem;
import com.campusbrew.campusbrew_api.model.Shop;
import com.campusbrew.campusbrew_api.model.User;
import com.campusbrew.campusbrew_api.model.UserRole;
import com.campusbrew.campusbrew_api.repository.InventoryMovementRepository;
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
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** v2.0 FR-5.5 / FR-5.2 — sales ledger, stock deduction, auto-unavailable, alerts, reports. */
class InventoryServiceTest {

    private InventoryMovementRepository movementRepo;
    private MenuItemRepository menuRepo;
    private SocketService socket;
    private PushNotificationService push;
    private InventoryService service;

    private final Map<String, MenuItem> menu = new HashMap<>();
    private final List<InventoryMovement> ledger = new ArrayList<>();

    @BeforeEach
    void setUp() {
        movementRepo = mock(InventoryMovementRepository.class);
        menuRepo = mock(MenuItemRepository.class);
        ShopRepository shopRepo = mock(ShopRepository.class);
        UserRepository userRepo = mock(UserRepository.class);
        ConfigService config = mock(ConfigService.class);
        socket = mock(SocketService.class);
        push = mock(PushNotificationService.class);

        when(config.getInventoryLowStockDefault()).thenReturn(5);
        Shop shop = Shop.builder().id("s1").operatorId("op1").shopName("Brew Central").build();
        when(shopRepo.findById("s1")).thenReturn(Optional.of(shop));
        when(shopRepo.findByOperatorId("op1")).thenReturn(List.of(shop));
        when(userRepo.findById("op1")).thenReturn(Optional.of(User.builder().id("op1").role(UserRole.SHOP_OPERATOR).build()));
        when(userRepo.findById("op2")).thenReturn(Optional.of(User.builder().id("op2").role(UserRole.SHOP_OPERATOR).build()));
        when(shopRepo.findByOperatorId("op2")).thenReturn(List.of(Shop.builder().id("s2").operatorId("op2").build()));

        menu.clear();
        ledger.clear();
        when(menuRepo.findById(anyString())).thenAnswer(inv -> Optional.ofNullable(menu.get(inv.getArgument(0))));
        when(menuRepo.save(any(MenuItem.class))).thenAnswer(inv -> inv.getArgument(0));
        when(menuRepo.findByShopIdOrderByCategory("s1")).thenAnswer(inv -> new ArrayList<>(menu.values()));
        when(movementRepo.save(any(InventoryMovement.class))).thenAnswer(inv -> {
            ledger.add(inv.getArgument(0));
            return inv.getArgument(0);
        });
        when(movementRepo.findByShopIdAndTypeAndCreatedAtGreaterThanEqual(anyString(), any(), any()))
                .thenAnswer(inv -> ledger.stream()
                        .filter(m -> m.getShopId().equals(inv.getArgument(0))
                                && m.getType() == inv.getArgument(1)
                                && !m.getCreatedAt().before(inv.getArgument(2)))
                        .toList());

        service = new InventoryService(movementRepo, menuRepo, shopRepo, userRepo, config, socket, push);
    }

    private MenuItem item(String id, String name, Integer stock) {
        MenuItem m = MenuItem.builder().id(id).shopId("s1").name(name).isAvailable(true)
                .stockTracking(stock != null).stockQty(stock).build();
        menu.put(id, m);
        return m;
    }

    private static Order order(OrderItem... lines) {
        return Order.builder().id("o1").shopId("s1").items(List.of(lines)).build();
    }

    private static OrderItem line(String itemId, int qty) {
        return OrderItem.builder().menuItemId(itemId).quantity(qty).build();
    }

    private void sale(String itemId, int qty, LocalDate day) {
        ledger.add(InventoryMovement.builder().shopId("s1").itemId(itemId).type(InventoryMovementType.SALE)
                .qty(qty).createdAt(Date.from(day.atTime(12, 0).atZone(InventoryService.CAMPUS_ZONE).toInstant()))
                .build());
    }

    @Test
    void saleDeductsTrackedStockAndLogsEveryItem() {
        MenuItem latte = item("latte", "Iced Latte", 20);
        item("tea", "Milk Tea", null); // untracked

        service.recordSale(order(line("latte", 2), line("tea", 1), line("latte", 1)));

        assertThat(latte.getStockQty()).isEqualTo(17);
        assertThat(latte.getStockStatus()).isEqualTo("In Stock");
        assertThat(ledger).hasSize(2);
        InventoryMovement latteSale = ledger.stream().filter(m -> m.getItemId().equals("latte")).findFirst().orElseThrow();
        assertThat(latteSale.getQty()).isEqualTo(3); // duplicate lines merged
        assertThat(latteSale.getBalanceAfter()).isEqualTo(17);
        InventoryMovement teaSale = ledger.stream().filter(m -> m.getItemId().equals("tea")).findFirst().orElseThrow();
        assertThat(teaSale.getBalanceAfter()).isNull();
        verifyNoInteractions(push);
    }

    @Test
    void reachingZeroMakesTheItemUnavailableAndAlertsTheShop() {
        MenuItem latte = item("latte", "Iced Latte", 2);

        service.recordSale(order(line("latte", 3)));

        assertThat(latte.getStockQty()).isZero();
        assertThat(latte.isAvailable()).isFalse();
        assertThat(latte.getStockStatus()).isEqualTo("Out of Stock");
        verify(socket).emitToUser(eq("op1"), eq("inventory:lowStock"), any());
        verify(push).send(eq("op1"), eq("Out of stock: Iced Latte"), anyString(), any());
    }

    @Test
    void lowStockAlertsOnceWhenCrossingTheLevel() {
        MenuItem latte = item("latte", "Iced Latte", 7);

        service.recordSale(order(line("latte", 3))); // 7 -> 4: crosses 5
        assertThat(latte.getStockStatus()).isEqualTo("Low Stock");
        assertThat(latte.isAvailable()).isTrue();

        service.recordSale(order(line("latte", 1))); // 4 -> 3: already low
        verify(push, times(1)).send(eq("op1"), eq("Low stock: Iced Latte"), anyString(), any());
    }

    @Test
    void restockBringsAnOutOfStockItemBack() {
        MenuItem latte = item("latte", "Iced Latte", 0);
        latte.setAvailable(false);

        InventoryItemDTO dto = service.restock("op1", "latte", 12);

        assertThat(latte.getStockQty()).isEqualTo(12);
        assertThat(latte.isAvailable()).isTrue();
        assertThat(latte.getStockStatus()).isEqualTo("In Stock");
        assertThat(dto.getStockQty()).isEqualTo(12);
        assertThat(ledger.get(0).getType()).isEqualTo(InventoryMovementType.RESTOCK);
    }

    @Test
    void restockNeedsTrackingAndAPositiveQuantity() {
        item("tea", "Milk Tea", null);
        assertThatThrownBy(() -> service.restock("op1", "tea", 5)).isInstanceOf(IllegalStateException.class);
        item("latte", "Iced Latte", 3);
        assertThatThrownBy(() -> service.restock("op1", "latte", 0)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void trackingCanBeTurnedOnAndOff() {
        MenuItem tea = item("tea", "Milk Tea", null);

        service.setTracking("op1", "tea", new StockTrackingDTO(true, 3, null));
        assertThat(tea.isStockTracking()).isTrue();
        assertThat(tea.getLowStockLevel()).isEqualTo(5); // config default
        assertThat(tea.getStockStatus()).isEqualTo("Low Stock");

        service.setTracking("op1", "tea", new StockTrackingDTO(false, null, null));
        assertThat(tea.isStockTracking()).isFalse();
        assertThat(tea.getStockQty()).isNull();
        assertThat(tea.getStockStatus()).isNull();
    }

    @Test
    void otherShopsCannotTouchTheItem() {
        item("latte", "Iced Latte", 10);
        assertThatThrownBy(() -> service.restock("op2", "latte", 5)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.list("someone", "today")).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void listShowsUnitsSoldForTodayOrThisWeek() {
        item("latte", "Iced Latte", 10);
        item("tea", "Milk Tea", null);
        LocalDate today = LocalDate.now(InventoryService.CAMPUS_ZONE);
        LocalDate monday = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        sale("latte", 4, today);
        sale("tea", 2, monday.minusDays(1)); // last week — never counted
        if (!monday.equals(today)) sale("tea", 3, monday);

        List<InventoryItemDTO> todayList = service.list("op1", "today");
        assertThat(todayList.get(0).getName()).isEqualTo("Iced Latte");
        assertThat(todayList.get(0).getUnitsSold()).isEqualTo(4);

        int teaWeek = service.list("op1", "week").stream()
                .filter(i -> i.getItemId().equals("tea")).findFirst().orElseThrow().getUnitsSold();
        assertThat(teaWeek).isEqualTo(monday.equals(today) ? 0 : 3);
    }

    @Test
    void trendGivesDailyBarsWeekOnWeekChangeAndSellers() {
        item("latte", "Iced Latte", 10);
        item("tea", "Milk Tea", null);
        item("mocha", "Mocha", null);
        LocalDate monday = LocalDate.now(InventoryService.CAMPUS_ZONE)
                .with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        sale("latte", 6, monday);
        sale("latte", 4, monday.minusWeeks(1));
        sale("tea", 2, monday);

        InventoryTrendDTO trend = service.trend("op1", "latte", "daily");

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
}
