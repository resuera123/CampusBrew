package com.campusbrew.campusbrew_api.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.geo.GeoJsonPoint;
import org.springframework.data.mongodb.core.index.GeoSpatialIndexType;
import org.springframework.data.mongodb.core.index.GeoSpatialIndexed;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.Date;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Document(collection = "deliveryPersonnel")
public class DeliveryPersonnel {

    @Id
    private String id;

    @Indexed(unique = true)
    private String userId;

    /**
     * Toggle controlled by the delivery personnel. When true, the assignment
     * engine considers this DP for proximity-based dispatch.
     */
    @JsonProperty("isActive")
    private boolean isActive;

    /**
     * GeoJSON Point [longitude, latitude]. 2dsphere index enables $near queries
     * for proximity-based assignment in Wave C.
     */
    @GeoSpatialIndexed(type = GeoSpatialIndexType.GEO_2DSPHERE)
    private GeoJsonPoint currentLocation;

    private Date locationUpdatedAt;

    private List<DaySchedule> weeklySchedule;

    private int totalDeliveries;

    @JsonProperty("incentiveActive")
    private boolean incentiveActive;

    /** Non-null while the DP is mid-delivery; prevents accepting new assignments. */
    private String currentOrderId;

    private Date createdAt;
    private Date updatedAt;
}
