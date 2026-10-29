package com.campusbrew.campusbrew_api.repository;

import com.campusbrew.campusbrew_api.model.Rating;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RatingRepository extends MongoRepository<Rating, String> {

    Optional<Rating> findByOrderIdAndRaterIdAndRateeId(String orderId, String raterId, String rateeId);

    List<Rating> findByOrderIdAndRaterId(String orderId, String raterId);

    /** All ratings for one ratee in one role — the basis for their average. */
    List<Rating> findByRateeIdAndRateeRole(String rateeId, String rateeRole);

    /** Visible reviews for a ratee (FR-2.1 shop and offer displays). */
    List<Rating> findByRateeIdAndHiddenFalse(String rateeId);
}
