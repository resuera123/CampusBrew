package com.campusbrew.campusbrew_api.dto;

import lombok.Data;

@Data
public class ShopApplicationRequest {
    private String stallName;
    private String location;
    private String operatorName;
    private String phoneNumber;
    private boolean agreedToRules;
    /** Downscaled JPEG data URIs ("data:image/jpeg;base64,..."). */
    private String stallPhoto;
    private String idPhoto;
}
