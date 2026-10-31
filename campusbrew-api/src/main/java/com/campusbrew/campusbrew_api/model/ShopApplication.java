package com.campusbrew.campusbrew_api.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.Date;

/**
 * A shop operator's request to open their shop to customers, reviewed by an
 * admin (mirrors DasherApplication). Photos are downscaled JPEG data URIs.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Document(collection = "shopApplications")
public class ShopApplication {

    @Id
    private String id;

    @Indexed
    private String userId;
    private String shopId;

    private String stallName;
    private String location;
    private String operatorName;
    private String phoneNumber;

    private boolean agreedToRules;

    private String stallPhoto;
    private String idPhoto;

    private ApplicationStatus status;
    private String rejectionReason;
    private String reviewedBy;
    private Date reviewedAt;

    private Date createdAt;
}
