package com.campusbrew.campusbrew_api.repository;

import com.campusbrew.campusbrew_api.model.Transaction;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TransactionRepository extends MongoRepository<Transaction, String> {

    List<Transaction> findByDeliveryPersonnelIdOrderByCreatedAtDesc(String deliveryPersonnelId);

    List<Transaction> findByShopIdOrderByCreatedAtDesc(String shopId);

    // v2.0 FR-4.8 — customer's completed transactions for the Payment Center.
    List<Transaction> findByCustomerIdOrderByCreatedAtDesc(String customerId);

    // v2.0 FR-4.7 — one transaction per delivered order; a post-delivery tip is added to it.
    Optional<Transaction> findByOrderId(String orderId);
}
