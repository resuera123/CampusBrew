package com.campusbrew.campusbrew_api.repository;

import com.campusbrew.campusbrew_api.model.Otp;
import com.campusbrew.campusbrew_api.model.OtpType;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface OtpRepository extends MongoRepository<Otp, String> {

    Optional<Otp> findByEmailAndTypeOrderByCreatedAtDesc(String email, OtpType type);

    void deleteByEmailAndType(String email, OtpType type);
}