package com.campusbrew.campusbrew_api.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Document(collection = "shops")
public class Shop {

    @Id
    private String id;

    private String shopName;
    private String description;
    private OperatingHours operatingHours;
    private String location;
    private String shopImage;

    @JsonProperty("isOpen")
    private boolean isOpen;
    private String operatorId;
    private String estimatedPrepTime;

    // v2.0 FR-3.6 — rating aggregates, recomputed by RatingService
    // (shown only once ratingCount >= rating.minCountToShow).
    private double ratingAvg;
    private int ratingCount;

    // Admin approval of the shop application. New shops start false (hidden,
    // can't open); null on shops from before approvals existed, which count as approved.
    private Boolean approved;

    /** Approved, or a shop from before approvals existed. */
    @com.fasterxml.jackson.annotation.JsonIgnore
    public boolean isApprovedShop() {
        return !Boolean.FALSE.equals(approved);
    }
}
