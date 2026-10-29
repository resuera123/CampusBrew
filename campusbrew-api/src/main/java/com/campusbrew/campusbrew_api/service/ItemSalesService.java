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
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.TextStyle;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * v2.0 FR-5.5 — sales by item and best sellers (no stock tracking).
 *
 * Every delivered order records the units sold per item. From that the shop sees
 * units sold per item today / this week, each item's trend, and an all-items chart
 * on the dashboard. Days and weeks are counted in Philippine time (weeks start
 * Monday) — the server itself runs in UTC.
 */
@Service
@RequiredArgsConstructor
public class ItemSalesService {

    static final ZoneId CAMPUS_ZONE = ZoneId.of("Asia/Manila");
    static final int TREND_WEEKS = 8;
    static final int CHART_DAYS = 7;
    static final int CHART_WEEKS = 4;
    private static final DateTimeFormatter WEEK_LABEL = DateTimeFormatter.ofPattern("MMM d", Locale.ENGLISH);

    private final ItemSaleRepository itemSaleRepository;
    private final MenuItemRepository menuItemRepository;
    private final ShopRepository shopRepository;
    private final UserRepository userRepository;

    /** Called when an order is delivered: one record per item (duplicate lines merged). */
    public void recordSale(Order order) {
        if (order.getItems() == null) return;
        Map<String, ItemSale> byItem = new LinkedHashMap<>();
        Date now = new Date();
        for (OrderItem line : order.getItems()) {
            if (line.getMenuItemId() == null || line.getQuantity() <= 0) continue;
            ItemSale sale = byItem.computeIfAbsent(line.getMenuItemId(), id -> ItemSale.builder()
                    .shopId(order.getShopId()).itemId(id).itemName(line.getItemName())
                    .orderId(order.getId()).createdAt(now).build());
            sale.setQty(sale.getQty() + line.getQuantity());
        }
        itemSaleRepository.saveAll(byItem.values());
    }

    /** Every menu item with units sold "today" or this "week", best seller first. */
    public List<ItemSalesDTO> list(String operatorUserId, String range) {
        Shop shop = requireOwnedShop(operatorUserId);
        LocalDate today = LocalDate.now(CAMPUS_ZONE);
        LocalDate from = "week".equalsIgnoreCase(range) ? startOfWeek(today) : today;
        Map<String, Integer> sold = unitsByItem(salesSince(shop.getId(), from));
        return menuItemRepository.findByShopIdOrderByCategory(shop.getId()).stream()
                .map(item -> ItemSalesDTO.builder()
                        .itemId(item.getId()).name(item.getName()).category(item.getCategory())
                        .unitsSold(sold.getOrDefault(item.getId(), 0))
                        .isAvailable(item.isAvailable())
                        .build())
                .sorted(Comparator.comparingInt(ItemSalesDTO::getUnitsSold).reversed()
                        .thenComparing(ItemSalesDTO::getName, String.CASE_INSENSITIVE_ORDER))
                .collect(Collectors.toList());
    }

    /** One item's trend: "daily" (Mon–Sun this week) or "weekly" (last 8 weeks). */
    public ItemTrendDTO trend(String operatorUserId, String itemId, String period) {
        MenuItem item = requireOwnedItem(operatorUserId, itemId);
        LocalDate thisMonday = startOfWeek(LocalDate.now(CAMPUS_ZONE));
        List<ItemSale> sales = salesSince(item.getShopId(), thisMonday.minusWeeks(TREND_WEEKS - 1));
        List<ItemSale> itemSales = sales.stream().filter(s -> itemId.equals(s.getItemId())).toList();

        boolean weekly = "weekly".equalsIgnoreCase(period);
        List<ItemTrendDTO.Point> points = new ArrayList<>();
        if (weekly) {
            for (int w = TREND_WEEKS - 1; w >= 0; w--) {
                LocalDate monday = thisMonday.minusWeeks(w);
                points.add(new ItemTrendDTO.Point(monday.format(WEEK_LABEL),
                        units(itemSales, monday, monday.plusWeeks(1))));
            }
        } else {
            for (int d = 0; d < 7; d++) {
                LocalDate day = thisMonday.plusDays(d);
                points.add(new ItemTrendDTO.Point(dayLabel(day), units(itemSales, day, day.plusDays(1))));
            }
        }

        int thisWeek = units(itemSales, thisMonday, thisMonday.plusWeeks(1));
        int lastWeek = units(itemSales, thisMonday.minusWeeks(1), thisMonday);
        Double change = lastWeek == 0 ? null : Math.round((thisWeek - lastWeek) * 1000.0 / lastWeek) / 10.0;

        // Shop-wide this week, for the best/slowest sellers card.
        Map<String, Integer> weekSold = unitsByItem(sales.stream()
                .filter(s -> !toLocalDate(s.getCreatedAt()).isBefore(thisMonday)).toList());
        List<MenuItem> ranked = menuItemRepository.findByShopIdOrderByCategory(item.getShopId()).stream()
                .sorted(Comparator.comparingInt((MenuItem m) -> weekSold.getOrDefault(m.getId(), 0)).reversed())
                .toList();
        List<String> best = ranked.stream().filter(m -> weekSold.getOrDefault(m.getId(), 0) > 0)
                .limit(2).map(MenuItem::getName).toList();
        List<String> slowest = ranked.size() < 2 ? List.of() : List.of(ranked.get(ranked.size() - 1).getName());

        return ItemTrendDTO.builder()
                .itemId(itemId).itemName(item.getName())
                .period(weekly ? "weekly" : "daily")
                .points(points)
                .thisWeek(thisWeek).lastWeek(lastWeek).changePct(change)
                .bestSellers(best).slowest(slowest)
                .build();
    }

    /**
     * Dashboard chart: units per item per day for the last 7 days ("7d", default) or
     * per week for the last 4 weeks ("4w"). Every menu item gets a series (so it can
     * be toggled on even with no sales), plus any sold item since removed.
     */
    public SalesChartDTO chart(String operatorUserId, String range) {
        Shop shop = requireOwnedShop(operatorUserId);
        LocalDate today = LocalDate.now(CAMPUS_ZONE);
        boolean weeks = "4w".equalsIgnoreCase(range);

        // Bucket boundaries: buckets[i] .. buckets[i+1].
        List<LocalDate> bounds = new ArrayList<>();
        List<String> labels = new ArrayList<>();
        if (weeks) {
            LocalDate firstMonday = startOfWeek(today).minusWeeks(CHART_WEEKS - 1);
            for (int w = 0; w <= CHART_WEEKS; w++) bounds.add(firstMonday.plusWeeks(w));
            for (int w = 0; w < CHART_WEEKS; w++) labels.add(bounds.get(w).format(WEEK_LABEL));
        } else {
            LocalDate firstDay = today.minusDays(CHART_DAYS - 1);
            for (int d = 0; d <= CHART_DAYS; d++) bounds.add(firstDay.plusDays(d));
            for (int d = 0; d < CHART_DAYS; d++) labels.add(dayLabel(bounds.get(d)));
        }

        List<ItemSale> sales = salesSince(shop.getId(), bounds.get(0));
        Map<String, String> names = new LinkedHashMap<>();
        menuItemRepository.findByShopIdOrderByCategory(shop.getId())
                .forEach(m -> names.put(m.getId(), m.getName()));
        sales.forEach(s -> names.putIfAbsent(s.getItemId(), s.getItemName() == null ? "Removed item" : s.getItemName()));
        Map<String, List<ItemSale>> byItem = sales.stream().collect(Collectors.groupingBy(ItemSale::getItemId));

        List<SalesChartDTO.Series> series = names.entrySet().stream().map(e -> {
            List<ItemSale> mine = byItem.getOrDefault(e.getKey(), List.of());
            List<Integer> units = new ArrayList<>();
            for (int i = 0; i < labels.size(); i++) {
                units.add(units(mine, bounds.get(i), bounds.get(i + 1)));
            }
            int total = units.stream().mapToInt(Integer::intValue).sum();
            return new SalesChartDTO.Series(e.getKey(), e.getValue(), units, total);
        }).sorted(Comparator.comparingInt(SalesChartDTO.Series::getTotal).reversed()
                .thenComparing(SalesChartDTO.Series::getName, String.CASE_INSENSITIVE_ORDER))
                .collect(Collectors.toList());

        return SalesChartDTO.builder().range(weeks ? "4w" : "7d").labels(labels).series(series).build();
    }

    // ─── Helpers ────────────────────────────────────────────────────────────

    private List<ItemSale> salesSince(String shopId, LocalDate from) {
        return itemSaleRepository.findByShopIdAndCreatedAtGreaterThanEqual(
                shopId, Date.from(from.atStartOfDay(CAMPUS_ZONE).toInstant()));
    }

    private static Map<String, Integer> unitsByItem(List<ItemSale> sales) {
        return sales.stream().collect(Collectors.groupingBy(ItemSale::getItemId, Collectors.summingInt(ItemSale::getQty)));
    }

    /** Units in [from, to) by Philippine date. */
    private static int units(List<ItemSale> sales, LocalDate from, LocalDate to) {
        return sales.stream()
                .filter(s -> {
                    LocalDate d = toLocalDate(s.getCreatedAt());
                    return !d.isBefore(from) && d.isBefore(to);
                })
                .mapToInt(ItemSale::getQty).sum();
    }

    private static LocalDate toLocalDate(Date date) {
        return Instant.ofEpochMilli(date.getTime()).atZone(CAMPUS_ZONE).toLocalDate();
    }

    private static LocalDate startOfWeek(LocalDate day) {
        return day.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
    }

    private static String dayLabel(LocalDate day) {
        return day.getDayOfWeek().getDisplayName(TextStyle.SHORT, Locale.ENGLISH);
    }

    private Shop requireOwnedShop(String operatorUserId) {
        User user = userRepository.findById(operatorUserId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        if (user.getRole() != UserRole.SHOP_OPERATOR) {
            throw new IllegalArgumentException("Only shop operators can view sales by item");
        }
        List<Shop> shops = shopRepository.findByOperatorId(operatorUserId);
        if (shops.isEmpty()) {
            throw new IllegalArgumentException("No shop found for this account");
        }
        return shops.get(0);
    }

    private MenuItem requireOwnedItem(String operatorUserId, String itemId) {
        Shop shop = requireOwnedShop(operatorUserId);
        MenuItem item = menuItemRepository.findById(itemId)
                .orElseThrow(() -> new IllegalArgumentException("Menu item not found"));
        if (!shop.getId().equals(item.getShopId())) {
            throw new IllegalArgumentException("This item belongs to another shop");
        }
        return item;
    }
}
