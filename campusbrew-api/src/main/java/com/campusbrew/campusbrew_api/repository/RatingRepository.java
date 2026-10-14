package com.campusbrew.campusbrew_api.repository;

import com.campusbrew.campusbrew_api.model.Rating;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RatingRepository extends MongoRepository<Rating, String> {

    Optional<Rating> findByOrderIdAndRaterIdAndRateeId(String orderId, String raterId, String rateeId);

    List<Rating> findByRateeId(String rateeId);

    List<Rating> findByRateeIdAndHiddenFalse(String rateeId);

    List<Rating> findByOrderId(String orderId);
}
