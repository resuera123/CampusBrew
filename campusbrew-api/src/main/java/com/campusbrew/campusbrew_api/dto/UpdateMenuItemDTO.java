package com.campusbrew.campusbrew_api.dto;

import com.campusbrew.campusbrew_api.model.CustomizationOptions;
import lombok.Data;

@Data
public class UpdateMenuItemDTO {
    private String name;
    private Double price;
    private String description;
    private String category;
    private String image;
    private Boolean isAvailable;
    private String stockStatus;
    private CustomizationOptions customizationOptions;
}
