package com.campusbrew.campusbrew_api.dto;

import lombok.Data;

@Data
public class UpdateProfileRequest {
    private String fullName;
    private String phoneNumber;
    private String profilePicture;
    private String address;
    private String dateOfBirth;
}
