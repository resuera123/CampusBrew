package com.campusbrew.campusbrew_api.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Document(collection = "menuItems")
public class MenuItem {

    @Id
    private String id;

    @Indexed
    private String shopId;

    private String name;
    private double price;
    private String description;
    private String category;
    private String image;
    private boolean isAvailable;
    private String stockStatus;
    private CustomizationOptions customizationOptions;
}
