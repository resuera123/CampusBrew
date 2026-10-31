package com.campusbrew.campusbrew_api.dto;

import com.campusbrew.campusbrew_api.model.ApplicationStatus;
import com.campusbrew.campusbrew_api.model.ShopApplication;
import com.campusbrew.campusbrew_api.model.User;
import lombok.Builder;
import lombok.Data;

import java.util.Date;

/** A shop application as the admin sees it; photos only on the detail view. */
@Data
@Builder
public class ShopApplicationDTO {
    private String id;
    private String userId;
    private String shopId;
    private String accountName;
    private String email;

    private String stallName;
    private String location;
    private String operatorName;
    private String phoneNumber;
    private boolean agreedToRules;

    private String stallPhoto;
    private String idPhoto;

    private ApplicationStatus status;
    private String rejectionReason;
    private Date reviewedAt;
    private Date createdAt;

    public static ShopApplicationDTO from(ShopApplication a, User u, boolean withPhotos) {
        return ShopApplicationDTO.builder()
                .id(a.getId())
                .userId(a.getUserId())
                .shopId(a.getShopId())
                .accountName(u == null ? null : u.getFullName())
                .email(u == null ? null : u.getEmail())
                .stallName(a.getStallName())
                .location(a.getLocation())
                .operatorName(a.getOperatorName())
                .phoneNumber(a.getPhoneNumber())
                .agreedToRules(a.isAgreedToRules())
                .stallPhoto(withPhotos ? a.getStallPhoto() : null)
                .idPhoto(withPhotos ? a.getIdPhoto() : null)
                .status(a.getStatus())
                .rejectionReason(a.getRejectionReason())
                .reviewedAt(a.getReviewedAt())
                .createdAt(a.getCreatedAt())
                .build();
    }
}
