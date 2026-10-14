package com.campusbrew.campusbrew_api.repository;

import com.campusbrew.campusbrew_api.model.Transaction;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TransactionRepository extends MongoRepository<Transaction, String> {

    List<Transaction> findByDeliveryPersonnelIdOrderByCreatedAtDesc(String deliveryPersonnelId);

    List<Transaction> findByShopIdOrderByCreatedAtDesc(String shopId);

    // v2.0 FR-4.8 — customer's completed transactions for the Payment Center.
    List<Transaction> findByCustomerIdOrderByCreatedAtDesc(String customerId);
}
