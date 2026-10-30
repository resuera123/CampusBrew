package com.campusbrew.campusbrew_api.service;

import com.campusbrew.campusbrew_api.dto.SalesReportDTO;
import com.campusbrew.campusbrew_api.model.Order;
import com.campusbrew.campusbrew_api.model.OrderItem;
import com.campusbrew.campusbrew_api.model.OrderStatus;
import com.campusbrew.campusbrew_api.model.PaymentMethod;
import com.campusbrew.campusbrew_api.model.PaymentStatus;
import com.campusbrew.campusbrew_api.model.Shop;
import com.campusbrew.campusbrew_api.model.User;
import com.campusbrew.campusbrew_api.model.UserRole;
import com.campusbrew.campusbrew_api.repository.OrderRepository;
import com.campusbrew.campusbrew_api.repository.ShopRepository;
import com.campusbrew.campusbrew_api.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.ZonedDateTime;
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

import static com.campusbrew.campusbrew_api.service.ItemSalesService.CAMPUS_ZONE;

/**
 * v2.0 FR-4.6 — daily / weekly sales report for the shop: totals with a comparison
 * to the period before, sales by hour or by day, GCash vs COD, the top items, the
 * delivered orders, and what was lost to cancellations.
 *
 * An order counts in the period it was delivered (or cancelled), in Philippine time,
 * weeks starting Monday — the same rules as Sales by Item.
 */
@Service
@RequiredArgsConstructor
public class SalesReportService {

    /** The hour chart always shows 6 AM–9 PM, widened if anything sold outside it. */
    static final int FIRST_HOUR = 6;
    static final int LAST_HOUR = 21;
    static final int MAX_OFFSET = 52;
    private static final DateTimeFormatter SHORT_DATE = DateTimeFormatter.ofPattern("MMM d", Locale.ENGLISH);

    private final OrderRepository orderRepository;
    private final ShopRepository shopRepository;
    private final UserRepository userRepository;

    public SalesReportDTO report(String operatorUserId, String range, int offset) {
        Shop shop = requireOwnedShop(operatorUserId);
        boolean week = "week".equalsIgnoreCase(range);
        int back = Math.max(0, Math.min(offset, MAX_OFFSET));

        LocalDate today = LocalDate.now(CAMPUS_ZONE);
        LocalDate from = week
                ? today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)).minusWeeks(back)
                : today.minusDays(back);
        LocalDate to = week ? from.plusWeeks(1) : from.plusDays(1);
        LocalDate prevFrom = week ? from.minusWeeks(1) : from.minusDays(1);

        // Orders are delivered within hours of being placed, so a day of slack is plenty.
        List<Order> orders = orderRepository.findByShopIdAndCreatedAtGreaterThanEqual(
                shop.getId(), toDate(prevFrom.minusDays(1)));

        List<Order> delivered = in(orders, OrderStatus.DELIVERED, from, to);
        List<Order> prevDelivered = in(orders, OrderStatus.DELIVERED, prevFrom, from);
        List<Order> cancelled = in(orders, OrderStatus.CANCELLED, from, to);

        double sales = sum(delivered);
        double prevSales = sum(prevDelivered);
        List<SalesReportDTO.Bucket> buckets = week ? byDay(delivered, from) : byHour(delivered);

        return SalesReportDTO.builder()
                .range(week ? "week" : "day")
                .offset(back)
                .label(label(week, back, from, to))
                .sales(round(sales))
                .orders(delivered.size())
                .avgOrder(round(average(sales, delivered.size())))
                .prevSales(round(prevSales))
                .prevOrders(prevDelivered.size())
                .prevAvgOrder(round(average(prevSales, prevDelivered.size())))
                .cancelledOrders(cancelled.size())
                .cancelledSales(round(sum(cancelled)))
                .refundedOrders((int) cancelled.stream().filter(SalesReportService::refunded).count())
                .buckets(buckets)
                .peakLabel(peak(buckets, week))
                .gcashSales(round(sum(byMethod(delivered, PaymentMethod.GCASH))))
                .gcashOrders(byMethod(delivered, PaymentMethod.GCASH).size())
                .codSales(round(sum(byMethod(delivered, PaymentMethod.COD))))
                .codOrders(byMethod(delivered, PaymentMethod.COD).size())
                .topItems(topItems(delivered))
                .orderList(delivered.stream()
                        .sorted(Comparator.comparing((Order o) -> o.reachedAt(OrderStatus.DELIVERED),
                                Comparator.nullsLast(Comparator.reverseOrder())))
                        .map(SalesReportService::line)
                        .toList())
                .build();
    }

    // ─── Periods and buckets ────────────────────────────────────

    /** Orders that reached {@code status} within [from, to) and are still in it. */
    private static List<Order> in(List<Order> orders, OrderStatus status, LocalDate from, LocalDate to) {
        return orders.stream()
                .filter(o -> o.getOrderStatus() == status)
                .filter(o -> {
                    Date at = o.reachedAt(status);
                    if (at == null) return false;
                    LocalDate day = at.toInstant().atZone(CAMPUS_ZONE).toLocalDate();
                    return !day.isBefore(from) && day.isBefore(to);
                })
                .toList();
    }

    private static List<SalesReportDTO.Bucket> byHour(List<Order> delivered) {
        Map<Integer, List<Order>> byHour = delivered.stream()
                .collect(Collectors.groupingBy(o -> zoned(o).getHour()));
        int first = Math.min(FIRST_HOUR, byHour.keySet().stream().min(Integer::compare).orElse(FIRST_HOUR));
        int last = Math.max(LAST_HOUR, byHour.keySet().stream().max(Integer::compare).orElse(LAST_HOUR));
        List<SalesReportDTO.Bucket> buckets = new ArrayList<>();
        for (int h = first; h <= last; h++) {
            List<Order> inHour = byHour.getOrDefault(h, List.of());
            buckets.add(bucket(hourLabel(h), inHour));
        }
        return buckets;
    }

    private static List<SalesReportDTO.Bucket> byDay(List<Order> delivered, LocalDate monday) {
        Map<LocalDate, List<Order>> byDay = delivered.stream()
                .collect(Collectors.groupingBy(o -> zoned(o).toLocalDate()));
        List<SalesReportDTO.Bucket> buckets = new ArrayList<>();
        for (int i = 0; i < 7; i++) {
            LocalDate day = monday.plusDays(i);
            buckets.add(bucket(day.getDayOfWeek().getDisplayName(TextStyle.SHORT, Locale.ENGLISH),
                    byDay.getOrDefault(day, List.of())));
        }
        return buckets;
    }

    private static SalesReportDTO.Bucket bucket(String label, List<Order> orders) {
        return SalesReportDTO.Bucket.builder().label(label).sales(round(sum(orders))).orders(orders.size()).build();
    }

    /** "12–1 PM" (hour) or "Wed" (day); null when nothing sold. */
    static String peak(List<SalesReportDTO.Bucket> buckets, boolean week) {
        SalesReportDTO.Bucket best = buckets.stream()
                .filter(b -> b.getSales() > 0)
                .max(Comparator.comparingDouble(SalesReportDTO.Bucket::getSales))
                .orElse(null);
        if (best == null) return null;
        if (week) return best.getLabel();
        int h = hourOf(best.getLabel());
        return hourRange(h);
    }

    static String hourLabel(int h) {
        int twelve = h % 12 == 0 ? 12 : h % 12;
        return twelve + (h < 12 ? "a" : "p");
    }

    private static int hourOf(String label) {
        int n = Integer.parseInt(label.substring(0, label.length() - 1));
        boolean pm = label.endsWith("p");
        return (n % 12) + (pm ? 12 : 0);
    }

    /** 12 → "12–1 PM", 11 → "11 AM–12 PM". */
    static String hourRange(int h) {
        int start = h % 12 == 0 ? 12 : h % 12;
        int endHour = (h + 1) % 24;
        int end = endHour % 12 == 0 ? 12 : endHour % 12;
        String startHalf = h < 12 ? "AM" : "PM";
        String endHalf = endHour < 12 ? "AM" : "PM";
        return startHalf.equals(endHalf)
                ? start + "–" + end + " " + endHalf
                : start + " " + startHalf + "–" + end + " " + endHalf;
    }

    private static String label(boolean week, int back, LocalDate from, LocalDate to) {
        if (week) {
            if (back == 0) return "This week";
            if (back == 1) return "Last week";
            return SHORT_DATE.format(from) + " – " + SHORT_DATE.format(to.minusDays(1));
        }
        if (back == 0) return "Today";
        if (back == 1) return "Yesterday";
        return from.getDayOfWeek().getDisplayName(TextStyle.SHORT, Locale.ENGLISH) + ", " + SHORT_DATE.format(from);
    }

    // ─── Totals ─────────────────────────────────────────────────

    private static List<SalesReportDTO.TopItem> topItems(List<Order> delivered) {
        Map<String, SalesReportDTO.TopItem> byItem = new LinkedHashMap<>();
        for (Order o : delivered) {
            if (o.getItems() == null) continue;
            for (OrderItem line : o.getItems()) {
                if (line.getMenuItemId() == null) continue;
                SalesReportDTO.TopItem t = byItem.computeIfAbsent(line.getMenuItemId(), id ->
                        SalesReportDTO.TopItem.builder().itemId(id).itemName(line.getItemName()).build());
                t.setQty(t.getQty() + line.getQuantity());
            }
        }
        return byItem.values().stream()
                .sorted(Comparator.comparingInt(SalesReportDTO.TopItem::getQty).reversed()
                        .thenComparing(SalesReportDTO.TopItem::getItemName,
                                Comparator.nullsLast(Comparator.naturalOrder())))
                .limit(3)
                .toList();
    }

    private static SalesReportDTO.OrderLine line(Order o) {
        String items = o.getItems() == null ? "" : o.getItems().stream()
                .map(i -> i.getQuantity() + "× " + i.getItemName())
                .collect(Collectors.joining(", "));
        return SalesReportDTO.OrderLine.builder()
                .orderId(o.getId())
                .deliveredAt(o.reachedAt(OrderStatus.DELIVERED))
                .items(items)
                .amount(round(o.getBeverageSubtotal()))
                .paymentMethod(o.getPaymentMethod() == null ? null : o.getPaymentMethod().name())
                .build();
    }

    private static boolean refunded(Order o) {
        return o.getPaymentStatus() == PaymentStatus.REFUNDED || o.getPaymentStatus() == PaymentStatus.REFUND_PENDING;
    }

    private static List<Order> byMethod(List<Order> orders, PaymentMethod method) {
        return orders.stream().filter(o -> o.getPaymentMethod() == method).toList();
    }

    private static double sum(List<Order> orders) {
        return orders.stream().mapToDouble(Order::getBeverageSubtotal).sum();
    }

    private static double average(double total, int count) {
        return count == 0 ? 0 : total / count;
    }

    private static double round(double v) {
        return Math.round(v * 100) / 100.0;
    }

    private static ZonedDateTime zoned(Order o) {
        return o.reachedAt(OrderStatus.DELIVERED).toInstant().atZone(CAMPUS_ZONE);
    }

    private static Date toDate(LocalDate day) {
        return Date.from(day.atStartOfDay(CAMPUS_ZONE).toInstant());
    }

    private Shop requireOwnedShop(String operatorUserId) {
        User user = userRepository.findById(operatorUserId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        if (user.getRole() != UserRole.SHOP_OPERATOR) {
            throw new IllegalArgumentException("Only shop operators can view the sales report");
        }
        return shopRepository.findByOperatorId(operatorUserId).stream().findFirst()
                .orElseThrow(() -> new IllegalArgumentException("No shop found for this account"));
    }
}
