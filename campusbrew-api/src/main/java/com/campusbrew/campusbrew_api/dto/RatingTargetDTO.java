package com.campusbrew.campusbrew_api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * v2.0 FR-3.6 — one party the caller can rate on an order, plus the caller's
 * existing rating of them (null fields if not rated yet).
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RatingTargetDTO {
    /** CUSTOMER, DELIVERY_PERSONNEL or SHOP. */
    private String rateeRole;
    private String name;
    private List<String> tagOptions;
    private boolean allowReview;

    private Integer stars;
    private List<String> tags;
    private String review;
}
