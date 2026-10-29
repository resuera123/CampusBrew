package com.campusbrew.campusbrew_api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Date;
import java.util.List;

/** v2.0 FR-3.6 — what the caller can rate on an order and whether the window is still open. */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RatingFormDTO {
    private String orderId;
    private boolean windowOpen;
    private Date closesAt;
    private List<RatingTargetDTO> targets;
}
