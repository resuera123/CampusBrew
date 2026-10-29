package com.campusbrew.campusbrew_api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * v2.0 FR-5.5 — one item's sales trend: daily bars for this week or weekly bars for
 * recent weeks, this week vs last week, and the shop's best and slowest sellers.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InventoryTrendDTO {
    private String itemId;
    private String itemName;
    /** "daily" or "weekly". */
    private String period;
    private List<Point> points;
    private int thisWeek;
    private int lastWeek;
    /** Week-on-week change in percent; null when last week had no sales. */
    private Double changePct;
    private List<String> bestSellers;
    private List<String> slowest;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Point {
        private String label;
        private int units;
    }
}
