package com.campusbrew.campusbrew_api.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class ReorderDTO {
    private String shopId;
    private String shopName;
    private List<ReorderItemDTO> items;
    private List<String> unavailableItems;
    private List<PriceChangeNote> priceChanges;
}
