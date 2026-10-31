package com.campusbrew.campusbrew_api.dto;

import lombok.Data;

@Data
public class ResetPasswordRequest {
    private String email;
    private String code;
    private String newPassword;

    // Phone keyboards often add a space after an autocompleted address.
    public void setEmail(String email) {
        this.email = email == null ? null : email.trim();
    }
}
