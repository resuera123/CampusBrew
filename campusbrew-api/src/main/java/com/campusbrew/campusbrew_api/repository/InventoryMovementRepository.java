package com.campusbrew.campusbrew_api.repository;

import com.campusbrew.campusbrew_api.model.InventoryMovement;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Date;
import java.util.List;

@Repository
public interface InventoryMovementRepository extends MongoRepository<InventoryMovement, String> {

    List<InventoryMovement> findByShopIdAndItemIdOrderByCreatedAtDesc(String shopId, String itemId);

    List<InventoryMovement> findByShopIdAndCreatedAtAfterOrderByCreatedAtDesc(String shopId, Date after);
}
