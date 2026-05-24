package com.campusbrew.campusbrew_api.dto;

import lombok.Data;

@Data
public class VerificationRequest {
    private String schoolEmail;
    private String otp;
    private String studentId;
}
