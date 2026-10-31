package com.campusbrew.campusbrew_api.dto;

import lombok.Data;

@Data
public class SchoolEmailRequest {
    private String schoolEmail;

    // Phone keyboards often add a space after an autocompleted address.
    public void setSchoolEmail(String schoolEmail) {
        this.schoolEmail = schoolEmail == null ? null : schoolEmail.trim();
    }
}
