package com.campusbrew.campusbrew_api.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.geo.GeoJsonPoint;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.Date;

/**
 * v2.0 FR-3.4 — a dasher location sample during an active delivery. 7-day TTL.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Document(collection = "locationPings")
public class LocationPing {

    @Id
    private String id;

    private String orderId;
    private String dpId;

    /** GeoJSON Point [longitude, latitude]. */
    private GeoJsonPoint point;

    private Date createdAt;
}
