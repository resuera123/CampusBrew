package com.campusbrew.campusbrew_api.repository;

import com.campusbrew.campusbrew_api.model.DeliveryAssignment;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DeliveryAssignmentRepository extends MongoRepository<DeliveryAssignment, String> {

    List<DeliveryAssignment> findByOrderId(String orderId);
}
