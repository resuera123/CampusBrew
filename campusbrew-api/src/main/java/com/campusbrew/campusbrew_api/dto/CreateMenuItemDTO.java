package com.campusbrew.campusbrew_api.dto;

import com.campusbrew.campusbrew_api.model.CustomizationOptions;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.PositiveOrZero;
import lombok.Data;

@Data
public class CreateMenuItemDTO {

    @NotBlank
    private String shopId;

    @NotBlank
    private String name;

    @PositiveOrZero
    private double price;

    private String description;

    @NotBlank
    private String category;

    private String image;

    @JsonProperty("isAvailable")
    private boolean isAvailable = true;

    private String stockStatus;

    private CustomizationOptions customizationOptions;
}
