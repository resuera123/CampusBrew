package com.campusbrew.campusbrew_api.repository;

import com.campusbrew.campusbrew_api.model.Shop;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ShopRepository extends MongoRepository<Shop, String> {

    List<Shop> findByIsOpenTrue();

    List<Shop> findByShopNameContainingIgnoreCase(String query);

    List<Shop> findByOperatorId(String operatorId);
}
