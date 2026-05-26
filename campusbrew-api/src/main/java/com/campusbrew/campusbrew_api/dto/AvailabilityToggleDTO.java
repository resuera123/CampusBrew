package com.campusbrew.campusbrew_api.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Data
public class AvailabilityToggleDTO {

    @JsonProperty("isActive")
    private boolean isActive;
}
