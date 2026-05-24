package com.campusbrew.campusbrew_api.repository;

import com.campusbrew.campusbrew_api.model.MenuItem;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MenuItemRepository extends MongoRepository<MenuItem, String> {

    List<MenuItem> findByShopIdOrderByCategory(String shopId);

    List<MenuItem> findByShopIdAndCategory(String shopId, String category);

    List<MenuItem> findByNameContainingIgnoreCase(String query);
}
