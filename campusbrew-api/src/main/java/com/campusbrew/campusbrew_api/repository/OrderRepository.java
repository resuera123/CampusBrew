package com.campusbrew.campusbrew_api.repository;

import com.campusbrew.campusbrew_api.model.Order;
import com.campusbrew.campusbrew_api.model.OrderStatus;
import com.campusbrew.campusbrew_api.model.PaymentStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;

@Repository
public interface OrderRepository extends MongoRepository<Order, String> {

    List<Order> findByPaymentStatus(PaymentStatus paymentStatus);

    Page<Order> findByCustomerIdOrderByCreatedAtDesc(String customerId, Pageable pageable);

    List<Order> findByShopIdAndOrderStatusInOrderByCreatedAtDesc(String shopId, Collection<OrderStatus> statuses);

    List<Order> findByShopIdOrderByCreatedAtDesc(String shopId);

    // FR-4.6 sales report: a shop's orders created since a date (filtered by delivery time after).
    List<Order> findByShopIdAndCreatedAtGreaterThanEqual(String shopId, java.util.Date from);

    /** Marketplace pool: accepted orders (PREPARING) that no dasher has claimed yet, oldest search first. */
    List<Order> findByOrderStatusInAndDeliveryPersonnelIdIsNullOrderByRiderSearchAtAsc(Collection<OrderStatus> statuses);

    /** Expiry input: orders still without a dasher whose rider search started before the cutoff. */
    List<Order> findByOrderStatusInAndDeliveryPersonnelIdIsNullAndRiderSearchAtLessThan(
            Collection<OrderStatus> statuses, java.util.Date cutoff);

    /** Re-broadcast input: unclaimed orders whose first offer window has passed. */
    List<Order> findByOrderStatusInAndDeliveryPersonnelIdIsNullAndRebroadcastAtIsNullAndRiderSearchAtLessThan(
            Collection<OrderStatus> statuses, java.util.Date cutoff);

    /** Marketplace pool (before rider search moved to accept): READY_FOR_PICKUP orders no DP claimed. */
    List<Order> findByOrderStatusAndDeliveryPersonnelIdIsNullOrderByReadyAtAsc(OrderStatus status);

    /** Scheduler input: any unclaimed READY_FOR_PICKUP older than the cutoff. */
    List<Order> findByOrderStatusAndDeliveryPersonnelIdIsNullAndReadyAtLessThan(OrderStatus status, java.util.Date cutoff);

    /**
     * v2.0 FR-3.2 — unclaimed READY_FOR_PICKUP orders whose 60s offer window has
     * lapsed and that have not yet been re-broadcast to all active dashers.
     */
    List<Order> findByOrderStatusAndDeliveryPersonnelIdIsNullAndRebroadcastAtIsNullAndReadyAtLessThan(
            OrderStatus status, java.util.Date cutoff);

    /** Dasher's completed-deliveries history. */
    List<Order> findByDeliveryPersonnelIdAndOrderStatusOrderByUpdatedAtDesc(String dpUserId, OrderStatus status);
}
