package com.campusbrew.campusbrew_api.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Document(collection = "shops")
public class Shop {

    @Id
    private String id;

    private String shopName;
    private String description;
    private OperatingHours operatingHours;
    private String location;
    private String shopImage;
    private double rating;

    @JsonProperty("isOpen")
    private boolean isOpen;
    private String operatorId;
    private String estimatedPrepTime;
}
