package com.campusbrew.campusbrew_api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * v2.0 FR-5.5 — units sold per item over time for the shop dashboard chart: one
 * series per item (every menu item, plus any sold item since removed), aligned to
 * {@code labels}, best seller first.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SalesChartDTO {
    /** "7d" (per day) or "4w" (per week). */
    private String range;
    private List<String> labels;
    private List<Series> series;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Series {
        private String itemId;
        private String name;
        private List<Integer> units;
        private int total;
    }
}
