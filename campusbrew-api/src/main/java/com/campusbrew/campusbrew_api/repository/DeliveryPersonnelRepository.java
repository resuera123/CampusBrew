package com.campusbrew.campusbrew_api.repository;

import com.campusbrew.campusbrew_api.model.DeliveryPersonnel;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface DeliveryPersonnelRepository extends MongoRepository<DeliveryPersonnel, String> {

    Optional<DeliveryPersonnel> findByUserId(String userId);
}
