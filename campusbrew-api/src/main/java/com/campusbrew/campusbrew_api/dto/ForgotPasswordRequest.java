package com.campusbrew.campusbrew_api.dto;

import lombok.Data;

@Data
public class ForgotPasswordRequest {
    private String email;

    // Phone keyboards often add a space after an autocompleted address.
    public void setEmail(String email) {
        this.email = email == null ? null : email.trim();
    }
}
