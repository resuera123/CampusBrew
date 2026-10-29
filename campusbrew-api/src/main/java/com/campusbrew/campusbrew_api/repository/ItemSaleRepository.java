package com.campusbrew.campusbrew_api.repository;

import com.campusbrew.campusbrew_api.model.ItemSale;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Date;
import java.util.List;

@Repository
public interface ItemSaleRepository extends MongoRepository<ItemSale, String> {

    /** A shop's sales since {@code from} — sales by item, trends, the dashboard chart. */
    List<ItemSale> findByShopIdAndCreatedAtGreaterThanEqual(String shopId, Date from);
}
