package com.campusbrew.campusbrew_api.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/** v2.0 FR-3.6 — ratings submitted for one order. Ratees are named by role, not id. */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class SubmitRatingsDTO {

    private List<Entry> ratings;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Entry {
        /** CUSTOMER, DELIVERY_PERSONNEL or SHOP. */
        private String rateeRole;
        private int stars;
        private List<String> tags;
        private String review;
    }
}
