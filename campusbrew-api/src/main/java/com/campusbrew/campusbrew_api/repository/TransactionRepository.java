package com.campusbrew.campusbrew_api.repository;

import com.campusbrew.campusbrew_api.model.Transaction;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TransactionRepository extends MongoRepository<Transaction, String> {

    List<Transaction> findByDeliveryPersonnelIdOrderByCreatedAtDesc(String deliveryPersonnelId);

    List<Transaction> findByShopIdOrderByCreatedAtDesc(String shopId);
}
