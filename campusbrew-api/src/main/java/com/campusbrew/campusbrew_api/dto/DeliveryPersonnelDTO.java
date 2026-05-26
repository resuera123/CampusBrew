package com.campusbrew.campusbrew_api.dto;

import com.campusbrew.campusbrew_api.model.DaySchedule;
import com.campusbrew.campusbrew_api.model.DeliveryPersonnel;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Builder;
import lombok.Data;

import java.util.Date;
import java.util.List;

@Data
@Builder
public class DeliveryPersonnelDTO {
    private String id;
    private String userId;

    @JsonProperty("isActive")
    private boolean isActive;

    /** Last known longitude (null if never reported). */
    private Double longitude;
    /** Last known latitude (null if never reported). */
    private Double latitude;
    private Date locationUpdatedAt;

    private List<DaySchedule> weeklySchedule;

    private int totalDeliveries;

    @JsonProperty("incentiveActive")
    private boolean incentiveActive;

    private String currentOrderId;

    public static DeliveryPersonnelDTO fromEntity(DeliveryPersonnel dp) {
        Double lng = null, lat = null;
        if (dp.getCurrentLocation() != null) {
            lng = dp.getCurrentLocation().getX();
            lat = dp.getCurrentLocation().getY();
        }
        return DeliveryPersonnelDTO.builder()
                .id(dp.getId())
                .userId(dp.getUserId())
                .isActive(dp.isActive())
                .longitude(lng)
                .latitude(lat)
                .locationUpdatedAt(dp.getLocationUpdatedAt())
                .weeklySchedule(dp.getWeeklySchedule())
                .totalDeliveries(dp.getTotalDeliveries())
                .incentiveActive(dp.isIncentiveActive())
                .currentOrderId(dp.getCurrentOrderId())
                .build();
    }
}
