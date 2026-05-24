package com.campusbrew.campusbrew_api.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CustomizationOptions {
    private List<SizeOption> sizes;
    private List<String> sugarLevels;
    private List<String> temperatures;
    private List<AddOnOption> addOns;
}
