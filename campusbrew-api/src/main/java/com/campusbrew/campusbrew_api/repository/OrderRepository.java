package com.campusbrew.campusbrew_api.repository;

import com.campusbrew.campusbrew_api.model.Order;
import com.campusbrew.campusbrew_api.model.OrderStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;

@Repository
public interface OrderRepository extends MongoRepository<Order, String> {

    Page<Order> findByCustomerIdOrderByCreatedAtDesc(String customerId, Pageable pageable);

    List<Order> findByShopIdAndOrderStatusInOrderByCreatedAtDesc(String shopId, Collection<OrderStatus> statuses);

    List<Order> findByShopIdOrderByCreatedAtDesc(String shopId);

    /** Marketplace pool: READY_FOR_PICKUP orders that no DP has claimed yet. */
    List<Order> findByOrderStatusAndDeliveryPersonnelIdIsNullOrderByReadyAtAsc(OrderStatus status);

    /** Scheduler input: any unclaimed READY_FOR_PICKUP older than the cutoff. */
    List<Order> findByOrderStatusAndDeliveryPersonnelIdIsNullAndReadyAtLessThan(OrderStatus status, java.util.Date cutoff);

    /** Dasher's completed-deliveries history. */
    List<Order> findByDeliveryPersonnelIdAndOrderStatusOrderByUpdatedAtDesc(String dpUserId, OrderStatus status);
}
