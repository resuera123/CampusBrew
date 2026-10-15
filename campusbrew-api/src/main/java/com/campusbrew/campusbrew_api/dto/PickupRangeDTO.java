package com.campusbrew.campusbrew_api.dto;

import lombok.Data;

// v2.0 FR-3.1 — null meters means "campus default" (no range cap on first offers).
@Data
public class PickupRangeDTO {
    private Integer meters;
}
