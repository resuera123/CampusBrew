package com.campusbrew.campusbrew_api.model;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.index.Indexed;

import java.time.Instant;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Document(collection = "otps")
public class Otp {

    @Id
    private String id;

    private String email;
    private String code;
    private OtpType type;

    @Indexed(expireAfter = "0s") // TTL — MongoDB deletes doc when expiresAt is reached
    private Instant expiresAt;

    private Instant createdAt;
}