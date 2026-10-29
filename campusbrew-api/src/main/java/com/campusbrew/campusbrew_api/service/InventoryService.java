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
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
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
 * v2.0 FR-5.5 (with FR-5.2) — inventory movement and sales trends.
 *
 * Every delivered order writes a SALE movement per item, tracked or not, so units
 * sold and trends come from one ledger. Items with stock tracking also have their
 * stock deducted: at 0 the item becomes unavailable ("Out of Stock"); at or below its
 * low-stock level it shows "Low Stock" and the shop is alerted (socket + push).
 * Restocking an item that ran out makes it available again.
 *
 * Days and weeks are counted in Philippine time (weeks start Monday) — the server
 * itself runs in UTC.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class InventoryService {

    static final ZoneId CAMPUS_ZONE = ZoneId.of("Asia/Manila");
    static final String IN_STOCK = "In Stock";
    static final String LOW_STOCK = "Low Stock";
    static final String OUT_OF_STOCK = "Out of Stock";
    static final int TREND_WEEKS = 8;

    private final InventoryMovementRepository movementRepository;
    private final MenuItemRepository menuItemRepository;
    private final ShopRepository shopRepository;
    private final UserRepository userRepository;
    private final ConfigService configService;
    private final SocketService socketService;
    private final PushNotificationService pushNotificationService;

    // ─── Sales (called when an order is delivered) ─────────────────────────

    /** Records one SALE per item on the order and deducts tracked stock. */
    public void recordSale(Order order) {
        if (order.getItems() == null) return;
        Map<String, Integer> qtyByItem = new LinkedHashMap<>();
        for (OrderItem line : order.getItems()) {
            if (line.getMenuItemId() != null && line.getQuantity() > 0) {
                qtyByItem.merge(line.getMenuItemId(), line.getQuantity(), Integer::sum);
            }
        }
        Date now = new Date();
        qtyByItem.forEach((itemId, qty) -> {
            MenuItem item = menuItemRepository.findById(itemId).orElse(null);
            if (item == null) return; // deleted from the menu since the order was placed
            Integer balance = null;
            if (item.isStockTracking() && item.getStockQty() != null) {
                int before = item.getStockQty();
                balance = Math.max(before - qty, 0);
                item.setStockQty(balance);
                applyStockState(item);
                menuItemRepository.save(item);
                alertIfCrossed(item, before, balance);
            }
            movementRepository.save(InventoryMovement.builder()
                    .shopId(order.getShopId()).itemId(itemId)
                    .type(InventoryMovementType.SALE).qty(qty)
                    .balanceAfter(balance).orderId(order.getId()).createdAt(now)
                    .build());
        });
    }

    // ─── Shop actions ───────────────────────────────────────────────────────

    public InventoryItemDTO setTracking(String operatorUserId, String itemId, StockTrackingDTO dto) {
        MenuItem item = requireOwnedItem(operatorUserId, itemId);
        if (!dto.isEnabled()) {
            item.setStockTracking(false);
            item.setStockQty(null);
            item.setLowStockLevel(null);
            item.setStockStatus(null);
            menuItemRepository.save(item);
            return toItem(item, 0);
        }
        int qty = dto.getQuantity() == null ? 0 : dto.getQuantity();
        int low = dto.getLowStockLevel() == null ? configService.getInventoryLowStockDefault() : dto.getLowStockLevel();
        if (qty < 0 || low < 0) {
            throw new IllegalArgumentException("Stock and low-stock level can't be negative");
        }
        boolean wasOut = item.isStockTracking() && item.getStockQty() != null && item.getStockQty() <= 0;
        item.setStockTracking(true);
        item.setStockQty(qty);
        item.setLowStockLevel(low);
        if (wasOut && qty > 0) item.setAvailable(true);
        applyStockState(item);
        menuItemRepository.save(item);
        movementRepository.save(InventoryMovement.builder()
                .shopId(item.getShopId()).itemId(itemId)
                .type(InventoryMovementType.ADJUST).qty(qty).balanceAfter(qty).createdAt(new Date())
                .build());
        return toItem(item, 0);
    }

    public InventoryItemDTO restock(String operatorUserId, String itemId, int qty) {
        if (qty <= 0) {
            throw new IllegalArgumentException("Restock quantity must be at least 1");
        }
        MenuItem item = requireOwnedItem(operatorUserId, itemId);
        if (!item.isStockTracking() || item.getStockQty() == null) {
            throw new IllegalStateException("Turn on stock tracking for this item first");
        }
        boolean wasOut = item.getStockQty() <= 0;
        int balance = item.getStockQty() + qty;
        item.setStockQty(balance);
        // Restocking an item that ran out puts it back on the menu (FR-5.2).
        if (wasOut) item.setAvailable(true);
        applyStockState(item);
        menuItemRepository.save(item);
        movementRepository.save(InventoryMovement.builder()
                .shopId(item.getShopId()).itemId(itemId)
                .type(InventoryMovementType.RESTOCK).qty(qty).balanceAfter(balance).createdAt(new Date())
                .build());
        return toItem(item, 0);
    }

    // ─── Reports ────────────────────────────────────────────────────────────

    /** Every item on the shop's menu with units sold "today" or this "week", and stock. */
    public List<InventoryItemDTO> list(String operatorUserId, String range) {
        Shop shop = requireOwnedShop(operatorUserId);
        LocalDate today = LocalDate.now(CAMPUS_ZONE);
        LocalDate from = "week".equalsIgnoreCase(range) ? startOfWeek(today) : today;
        Map<String, Integer> sold = unitsByItem(salesSince(shop.getId(), from));
        return menuItemRepository.findByShopIdOrderByCategory(shop.getId()).stream()
                .map(item -> toItem(item, sold.getOrDefault(item.getId(), 0)))
                .sorted(Comparator.comparingInt(InventoryItemDTO::getUnitsSold).reversed()
                        .thenComparing(InventoryItemDTO::getName, String.CASE_INSENSITIVE_ORDER))
                .collect(Collectors.toList());
    }

    /** One item's trend: "daily" (Mon–Sun this week) or "weekly" (last 8 weeks). */
    public InventoryTrendDTO trend(String operatorUserId, String itemId, String period) {
        MenuItem item = requireOwnedItem(operatorUserId, itemId);
        LocalDate today = LocalDate.now(CAMPUS_ZONE);
        LocalDate thisMonday = startOfWeek(today);
        LocalDate oldestMonday = thisMonday.minusWeeks(TREND_WEEKS - 1);
        List<InventoryMovement> sales = salesSince(item.getShopId(), oldestMonday);
        List<InventoryMovement> itemSales = sales.stream().filter(m -> itemId.equals(m.getItemId())).toList();

        boolean weekly = "weekly".equalsIgnoreCase(period);
        List<InventoryTrendDTO.Point> points = new ArrayList<>();
        if (weekly) {
            for (int w = TREND_WEEKS - 1; w >= 0; w--) {
                LocalDate monday = thisMonday.minusWeeks(w);
                points.add(new InventoryTrendDTO.Point(
                        monday.getMonthValue() + "/" + monday.getDayOfMonth(),
                        units(itemSales, monday, monday.plusWeeks(1))));
            }
        } else {
            for (int d = 0; d < 7; d++) {
                LocalDate day = thisMonday.plusDays(d);
                points.add(new InventoryTrendDTO.Point(
                        day.getDayOfWeek().getDisplayName(TextStyle.SHORT, Locale.ENGLISH),
                        units(itemSales, day, day.plusDays(1))));
            }
        }

        int thisWeek = units(itemSales, thisMonday, thisMonday.plusWeeks(1));
        int lastWeek = units(itemSales, thisMonday.minusWeeks(1), thisMonday);
        Double change = lastWeek == 0 ? null : Math.round((thisWeek - lastWeek) * 1000.0 / lastWeek) / 10.0;

        // Shop-wide this week, for the best/slowest sellers card.
        Map<String, Integer> weekSold = unitsByItem(sales.stream()
                .filter(m -> !toLocalDate(m.getCreatedAt()).isBefore(thisMonday)).toList());
        List<MenuItem> menu = menuItemRepository.findByShopIdOrderByCategory(item.getShopId());
        List<MenuItem> ranked = menu.stream()
                .sorted(Comparator.comparingInt((MenuItem m) -> weekSold.getOrDefault(m.getId(), 0)).reversed())
                .toList();
        List<String> best = ranked.stream().filter(m -> weekSold.getOrDefault(m.getId(), 0) > 0)
                .limit(2).map(MenuItem::getName).toList();
        List<String> slowest = ranked.size() < 2 ? List.of()
                : List.of(ranked.get(ranked.size() - 1).getName());

        return InventoryTrendDTO.builder()
                .itemId(itemId).itemName(item.getName())
                .period(weekly ? "weekly" : "daily")
                .points(points)
                .thisWeek(thisWeek).lastWeek(lastWeek).changePct(change)
                .bestSellers(best).slowest(slowest)
                .build();
    }

    // ─── Helpers ────────────────────────────────────────────────────────────

    /** Sets the customer-facing stock badge and turns the item off at zero (FR-5.2). */
    private void applyStockState(MenuItem item) {
        int qty = item.getStockQty() == null ? 0 : item.getStockQty();
        int low = item.getLowStockLevel() == null ? configService.getInventoryLowStockDefault() : item.getLowStockLevel();
        if (qty <= 0) {
            item.setStockStatus(OUT_OF_STOCK);
            item.setAvailable(false);
        } else if (qty <= low) {
            item.setStockStatus(LOW_STOCK);
        } else {
            item.setStockStatus(IN_STOCK);
        }
    }

    /** Alerts the shop once, when a sale takes stock to/below the low level or to zero. */
    private void alertIfCrossed(MenuItem item, int before, int after) {
        int low = item.getLowStockLevel() == null ? configService.getInventoryLowStockDefault() : item.getLowStockLevel();
        boolean ranOut = before > 0 && after <= 0;
        boolean wentLow = before > low && after <= low && after > 0;
        if (!ranOut && !wentLow) return;

        String operatorId = shopRepository.findById(item.getShopId()).map(Shop::getOperatorId).orElse(null);
        if (operatorId == null) return;
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("itemId", item.getId());
        payload.put("name", item.getName());
        payload.put("stockQty", after);
        socketService.emitToUser(operatorId, "inventory:lowStock", payload);
        pushNotificationService.send(operatorId,
                ranOut ? "Out of stock: " + item.getName() : "Low stock: " + item.getName(),
                ranOut ? "It's now hidden from customers. Restock to put it back on the menu."
                        : after + " left. Restock soon.",
                Map.of("type", "inventory", "itemId", item.getId()));
    }

    private InventoryItemDTO toItem(MenuItem item, int unitsSold) {
        boolean tracked = item.isStockTracking() && item.getStockQty() != null;
        Integer low = tracked ? (item.getLowStockLevel() == null
                ? configService.getInventoryLowStockDefault() : item.getLowStockLevel()) : null;
        return InventoryItemDTO.builder()
                .itemId(item.getId()).name(item.getName()).category(item.getCategory())
                .unitsSold(unitsSold)
                .stockTracking(tracked)
                .stockQty(tracked ? item.getStockQty() : null)
                .lowStockLevel(low)
                .lowStock(tracked && item.getStockQty() <= low)
                .isAvailable(item.isAvailable())
                .build();
    }

    private List<InventoryMovement> salesSince(String shopId, LocalDate from) {
        Date start = Date.from(from.atStartOfDay(CAMPUS_ZONE).toInstant());
        return movementRepository.findByShopIdAndTypeAndCreatedAtGreaterThanEqual(
                shopId, InventoryMovementType.SALE, start);
    }

    private static Map<String, Integer> unitsByItem(List<InventoryMovement> sales) {
        return sales.stream().collect(Collectors.groupingBy(
                InventoryMovement::getItemId, Collectors.summingInt(InventoryMovement::getQty)));
    }

    /** Units in [from, to) by Philippine date. */
    private static int units(List<InventoryMovement> sales, LocalDate from, LocalDate to) {
        return sales.stream()
                .filter(m -> {
                    LocalDate d = toLocalDate(m.getCreatedAt());
                    return !d.isBefore(from) && d.isBefore(to);
                })
                .mapToInt(InventoryMovement::getQty).sum();
    }

    private static LocalDate toLocalDate(Date date) {
        return Instant.ofEpochMilli(date.getTime()).atZone(CAMPUS_ZONE).toLocalDate();
    }

    private static LocalDate startOfWeek(LocalDate day) {
        return day.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
    }

    private Shop requireOwnedShop(String operatorUserId) {
        User user = userRepository.findById(operatorUserId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        if (user.getRole() != UserRole.SHOP_OPERATOR) {
            throw new IllegalArgumentException("Only shop operators can manage inventory");
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
