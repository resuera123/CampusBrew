package com.campusbrew.campusbrew_api.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.Date;
import java.util.List;

/**
 * v2.0 FR-3.6 — one rating per (order, rater, ratee). raterRole/rateeRole are
 * role strings (CUSTOMER / DELIVERY_PERSONNEL / SHOP_OPERATOR / SHOP).
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Document(collection = "ratings")
public class Rating {

    @Id
    private String id;

    private String orderId;
    private String raterId;
    private String raterRole;

    @Indexed
    private String rateeId;
    private String rateeRole;

    private int stars;
    private List<String> tags;
    private String review;

    /** Hidden by the moderation filter (blocked words); excluded from averages display. */
    private boolean hidden;

    private Date createdAt;
    private Date updatedAt;
}
