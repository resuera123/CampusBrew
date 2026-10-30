package com.campusbrew.campusbrew_api.dto;

import lombok.Builder;
import lombok.Data;

import java.util.Date;
import java.util.List;

/** v2.0 FR-4.6 — a shop's daily or weekly sales report. Money is the drinks subtotal. */
@Data
@Builder
public class SalesReportDTO {
    /** "day" or "week". */
    private String range;
    /** 0 = today / this week, 1 = the one before, ... */
    private int offset;
    /** "Today", "Yesterday", "Oct 28" / "This week", "Last week", "Oct 13 – 19". */
    private String label;

    private double sales;
    private int orders;
    private double avgOrder;

    // The period before, for the "▲ 12%" comparisons.
    private double prevSales;
    private int prevOrders;
    private double prevAvgOrder;

    private int cancelledOrders;
    private double cancelledSales;
    /** Paid GCash orders that were cancelled and refunded (or are being refunded). */
    private int refundedOrders;

    /** Hours of the day (6 AM–9 PM, widened if needed) or Mon–Sun. */
    private List<Bucket> buckets;
    /** "12–1 PM" or "Wed"; null when nothing sold. */
    private String peakLabel;

    private double gcashSales;
    private int gcashOrders;
    private double codSales;
    private int codOrders;

    private List<TopItem> topItems;
    private List<OrderLine> orderList;

    @Data
    @Builder
    public static class Bucket {
        private String label;
        private double sales;
        private int orders;
    }

    @Data
    @Builder
    public static class TopItem {
        private String itemId;
        private String itemName;
        private int qty;
    }

    @Data
    @Builder
    public static class OrderLine {
        private String orderId;
        private Date deliveredAt;
        /** "2× Latte, 1× Matcha". */
        private String items;
        private double amount;
        private String paymentMethod;
    }
}
