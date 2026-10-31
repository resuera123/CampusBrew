package com.campusbrew.campusbrew_api.repository;

import com.campusbrew.campusbrew_api.model.ApplicationStatus;
import com.campusbrew.campusbrew_api.model.ShopApplication;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ShopApplicationRepository extends MongoRepository<ShopApplication, String> {

    // The photos are large, so lists and status checks leave them out.
    String NO_PHOTOS = "{ 'stallPhoto': 0, 'idPhoto': 0 }";

    @Query(value = "{ 'userId': ?0 }", fields = NO_PHOTOS, sort = "{ 'createdAt': -1 }")
    List<ShopApplication> findByUserIdNewestFirst(String userId);

    @Query(value = "{ 'status': ?0 }", fields = NO_PHOTOS, sort = "{ 'createdAt': 1 }")
    List<ShopApplication> findByStatusOldestFirst(ApplicationStatus status);

    @Query(value = "{}", fields = NO_PHOTOS, sort = "{ 'createdAt': -1 }")
    List<ShopApplication> findAllNewestFirst();

    boolean existsByUserIdAndStatus(String userId, ApplicationStatus status);
}
