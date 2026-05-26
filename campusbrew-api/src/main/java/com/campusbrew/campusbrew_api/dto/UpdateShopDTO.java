package com.campusbrew.campusbrew_api.dto;

import com.campusbrew.campusbrew_api.model.OperatingHours;
import lombok.Data;

@Data
public class UpdateShopDTO {
    private String shopName;
    private String description;
    private OperatingHours operatingHours;
    private String location;
    private String shopImage;
    private String estimatedPrepTime;
    private Boolean isOpen;
}
