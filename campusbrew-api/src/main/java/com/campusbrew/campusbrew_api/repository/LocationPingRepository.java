package com.campusbrew.campusbrew_api.repository;

import com.campusbrew.campusbrew_api.model.LocationPing;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LocationPingRepository extends MongoRepository<LocationPing, String> {

    List<LocationPing> findByOrderIdOrderByCreatedAtDesc(String orderId);
}
