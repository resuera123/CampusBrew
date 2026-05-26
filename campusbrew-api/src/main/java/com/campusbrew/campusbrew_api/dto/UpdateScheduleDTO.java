package com.campusbrew.campusbrew_api.dto;

import com.campusbrew.campusbrew_api.model.DaySchedule;
import lombok.Data;

import java.util.List;

@Data
public class UpdateScheduleDTO {
    private List<DaySchedule> schedule;
}
