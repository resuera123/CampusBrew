package com.campusbrew.campusbrew_api.dto;

import lombok.Data;

@Data
public class DasherApplicationRequest {
    private String phoneNumber;
    private String reason;
    private String course;
    private int yearLevel;
    private String emergencyName;
    private String emergencyRelationship;
    private String emergencyPhone;
    private boolean agreedToRules;
    /** Downscaled JPEG data URIs ("data:image/jpeg;base64,..."). */
    private String idPhoto;
    private String selfiePhoto;
    private String corPhoto;
}
