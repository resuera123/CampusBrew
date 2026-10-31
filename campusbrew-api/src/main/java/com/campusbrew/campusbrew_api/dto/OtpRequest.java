package com.campusbrew.campusbrew_api.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class OtpRequest {

    @Email
    @NotBlank
    private String email;

    @NotBlank
    private String otp;

    // Phone keyboards often add a space after an autocompleted address.
    public void setEmail(String email) {
        this.email = email == null ? null : email.trim();
    }
}
