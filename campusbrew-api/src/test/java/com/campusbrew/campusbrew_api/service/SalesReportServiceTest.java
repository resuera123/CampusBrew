package com.campusbrew.campusbrew_api.service;

import com.campusbrew.campusbrew_api.dto.SalesReportDTO;
import com.campusbrew.campusbrew_api.model.Order;
import com.campusbrew.campusbrew_api.model.OrderItem;
import com.campusbrew.campusbrew_api.model.OrderStatus;
import com.campusbrew.campusbrew_api.model.PaymentMethod;
import com.campusbrew.campusbrew_api.model.PaymentStatus;
import com.campusbrew.campusbrew_api.model.Shop;
import com.campusbrew.campusbrew_api.model.StatusHistoryEntry;
import com.campusbrew.campusbrew_api.model.User;
import com.campusbrew.campusbrew_api.model.UserRole;
import com.campusbrew.campusbrew_api.repository.OrderRepository;
import com.campusbrew.campusbrew_api.repository.ShopRepository;
import com.campusbrew.campusbrew_api.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Optional;

import static com.campusbrew.campusbrew_api.service.ItemSalesService.CAMPUS_ZONE;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/** v2.0 FR-4.6 — daily / weekly sales report. */
class SalesReportServiceTest {

    private final List<Order> orders = new ArrayList<>();
    private SalesReportService service;
    private final LocalDate today = LocalDate.now(CAMPUS_ZONE);

    @BeforeEach
    void setUp() {
        OrderRepository orderRepo = mock(OrderRepository.class);
        ShopRepository shopRepo = mock(ShopRepository.class);
        UserRepository userRepo = mock(UserRepository.class);
        service = new SalesReportService(orderRepo, shopRepo, userRepo);

        when(userRepo.findById("op")).thenReturn(Optional.of(User.builder().id("op").role(UserRole.SHOP_OPERATOR).build()));
        when(shopRepo.findByOperatorId("op")).thenReturn(List.of(Shop.builder().id("s1").operatorId("op").build()));
        when(orderRepo.findByShopIdAndCreatedAtGreaterThanEqual(eq("s1"), any(Date.class))).thenReturn(orders);
    }

    /** An order that reached {@code status} on {@code day} at {@code hour}:00 Philippine time. */
    private Order order(OrderStatus status, LocalDate day, int hour, double subtotal, PaymentMethod method,
                        OrderItem... items) {
        Date at = Date.from(day.atTime(LocalTime.of(hour, 15)).atZone(CAMPUS_ZONE).toInstant());
        Order o = Order.builder()
                .id("o" + orders.size())
                .orderStatus(status)
                .paymentMethod(method)
                .paymentStatus(method == PaymentMethod.GCASH ? PaymentStatus.PAID_GCASH : PaymentStatus.PAID_COD)
                .beverageSubtotal(subtotal)
                .items(List.of(items))
                .statusHistory(List.of(StatusHistoryEntry.builder().status(status).timestamp(at).build()))
                .createdAt(at)
                .updatedAt(at)
                .build();
        orders.add(o);
        return o;
    }

    private static OrderItem item(String id, String name, int qty) {
        return OrderItem.builder().menuItemId(id).itemName(name).quantity(qty).build();
    }

    @Test
    void dayReportTotalsComparesAndSplitsByPayment() {
        order(OrderStatus.DELIVERED, today, 9, 100, PaymentMethod.GCASH, item("m1", "Latte", 2));
        order(OrderStatus.DELIVERED, today, 12, 150, PaymentMethod.COD, item("m2", "Matcha", 1), item("m1", "Latte", 1));
        order(OrderStatus.DELIVERED, today, 14, 50, PaymentMethod.GCASH, item("m3", "Tea", 1));
        order(OrderStatus.DELIVERED, today.minusDays(1), 10, 200, PaymentMethod.GCASH, item("m1", "Latte", 4));
        Order refunded = order(OrderStatus.CANCELLED, today, 13, 80, PaymentMethod.GCASH, item("m2", "Matcha", 1));
        refunded.setPaymentStatus(PaymentStatus.REFUNDED);

        SalesReportDTO r = service.report("op", "day", 0);

        assertThat(r.getLabel()).isEqualTo("Today");
        assertThat(r.getSales()).isEqualTo(300);
        assertThat(r.getOrders()).isEqualTo(3);
        assertThat(r.getAvgOrder()).isEqualTo(100);
        assertThat(r.getPrevSales()).isEqualTo(200);
        assertThat(r.getPrevOrders()).isEqualTo(1);
        assertThat(r.getCancelledOrders()).isEqualTo(1);
        assertThat(r.getCancelledSales()).isEqualTo(80);
        assertThat(r.getRefundedOrders()).isEqualTo(1);
        assertThat(r.getGcashSales()).isEqualTo(150);
        assertThat(r.getGcashOrders()).isEqualTo(2);
        assertThat(r.getCodSales()).isEqualTo(150);
        assertThat(r.getCodOrders()).isEqualTo(1);
        assertThat(r.getTopItems()).extracting(SalesReportDTO.TopItem::getItemName)
                .containsExactly("Latte", "Matcha", "Tea");
        assertThat(r.getTopItems().get(0).getQty()).isEqualTo(3);
        assertThat(r.getOrderList()).hasSize(3);
        assertThat(r.getOrderList().get(0).getItems()).isEqualTo("1× Tea"); // newest first
    }

    @Test
    void hourChartRunsSixAmToNinePmAndNamesThePeak() {
        order(OrderStatus.DELIVERED, today, 9, 100, PaymentMethod.GCASH);
        order(OrderStatus.DELIVERED, today, 12, 150, PaymentMethod.COD);
        order(OrderStatus.DELIVERED, today, 12, 50, PaymentMethod.GCASH);

        SalesReportDTO r = service.report("op", "day", 0);

        assertThat(r.getBuckets()).hasSize(16);
        assertThat(r.getBuckets().get(0).getLabel()).isEqualTo("6a");
        assertThat(r.getBuckets().get(15).getLabel()).isEqualTo("9p");
        assertThat(r.getPeakLabel()).isEqualTo("12–1 PM");
    }

    @Test
    void lateOrdersWidenTheHourChart() {
        order(OrderStatus.DELIVERED, today, 22, 100, PaymentMethod.GCASH);
        assertThat(service.report("op", "day", 0).getBuckets()).extracting(SalesReportDTO.Bucket::getLabel)
                .endsWith("9p", "10p");
    }

    @Test
    void weekReportHasSevenDaysFromMonday() {
        LocalDate monday = today.with(java.time.temporal.TemporalAdjusters.previousOrSame(java.time.DayOfWeek.MONDAY));
        order(OrderStatus.DELIVERED, monday, 10, 100, PaymentMethod.GCASH);
        order(OrderStatus.DELIVERED, monday.minusDays(1), 10, 70, PaymentMethod.GCASH); // last week's Sunday

        SalesReportDTO r = service.report("op", "week", 0);

        assertThat(r.getLabel()).isEqualTo("This week");
        assertThat(r.getBuckets()).extracting(SalesReportDTO.Bucket::getLabel)
                .containsExactly("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun");
        assertThat(r.getSales()).isEqualTo(100);
        assertThat(r.getPrevSales()).isEqualTo(70);
        assertThat(r.getPeakLabel()).isEqualTo("Mon");
    }

    @Test
    void earlierDaysHaveTheirOwnLabels() {
        assertThat(service.report("op", "day", 1).getLabel()).isEqualTo("Yesterday");
        assertThat(service.report("op", "week", 1).getLabel()).isEqualTo("Last week");
        assertThat(service.report("op", "day", 0).getPeakLabel()).isNull();
    }

    @Test
    void hourRanges() {
        assertThat(SalesReportService.hourRange(12)).isEqualTo("12–1 PM");
        assertThat(SalesReportService.hourRange(11)).isEqualTo("11 AM–12 PM");
        assertThat(SalesReportService.hourRange(9)).isEqualTo("9–10 AM");
    }

    @Test
    void onlyShopOperators() {
        SalesReportService other = new SalesReportService(mock(OrderRepository.class), mock(ShopRepository.class),
                mockUser(UserRole.CUSTOMER));
        assertThatThrownBy(() -> other.report("op", "day", 0)).hasMessageContaining("shop operators");
    }

    private static UserRepository mockUser(UserRole role) {
        UserRepository repo = mock(UserRepository.class);
        when(repo.findById("op")).thenReturn(Optional.of(User.builder().id("op").role(role).build()));
        return repo;
    }
}
