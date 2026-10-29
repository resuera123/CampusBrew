package com.campusbrew.campusbrew_api.repository;

import com.campusbrew.campusbrew_api.model.Payment;
import com.campusbrew.campusbrew_api.model.PaymentRecordStatus;
import com.campusbrew.campusbrew_api.model.PaymentType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PaymentRepository extends MongoRepository<Payment, String> {

    Optional<Payment> findByGatewayChargeId(String gatewayChargeId);

    /** An order can have an ORDER payment and a post-delivery TIP payment (FR-4.7). */
    List<Payment> findByOrderIdAndType(String orderId, PaymentType type);

    Page<Payment> findByUserIdOrderByCreatedAtDesc(String userId, Pageable pageable);

    List<Payment> findByStatus(PaymentRecordStatus status);
}
