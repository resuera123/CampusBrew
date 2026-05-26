package com.campusbrew.campusbrew_api.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DaySchedule {
    /** "MONDAY" .. "SUNDAY" — kept as String for simple JSON interchange. */
    private String dayOfWeek;
    private boolean enabled;
    /** "HH:mm" 24-hour format. */
    private String startTime;
    private String endTime;
}
