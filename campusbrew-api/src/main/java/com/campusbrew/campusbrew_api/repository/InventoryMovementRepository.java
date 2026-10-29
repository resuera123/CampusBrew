package com.campusbrew.campusbrew_api.repository;

import com.campusbrew.campusbrew_api.model.InventoryMovement;
import com.campusbrew.campusbrew_api.model.InventoryMovementType;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Date;
import java.util.List;

@Repository
public interface InventoryMovementRepository extends MongoRepository<InventoryMovement, String> {

    /** A shop's movements of one type since {@code from} — units sold, trends, best sellers. */
    List<InventoryMovement> findByShopIdAndTypeAndCreatedAtGreaterThanEqual(
            String shopId, InventoryMovementType type, Date from);
}
