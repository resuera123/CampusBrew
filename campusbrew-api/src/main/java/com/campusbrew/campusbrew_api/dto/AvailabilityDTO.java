package com.campusbrew.campusbrew_api.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Data
public class AvailabilityDTO {

    // @JsonProperty needed: Lombok generates getter isAvailable() for a primitive
    // boolean, and Jackson would otherwise strip "is" and look for the JSON key
    // "available". Without this override every PATCH from the frontend gets
    // deserialized as false (since the frontend sends "isAvailable").
    @JsonProperty("isAvailable")
    private boolean isAvailable;
}
