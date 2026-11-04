package com.campusbrew.campusbrew_api.repository;

import com.campusbrew.campusbrew_api.model.ReportStatus;
import com.campusbrew.campusbrew_api.model.SupportTicket;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SupportTicketRepository extends MongoRepository<SupportTicket, String> {

    List<SupportTicket> findByStatusOrderByCreatedAtDesc(ReportStatus status);

    List<SupportTicket> findAllByOrderByCreatedAtDesc();

    long countByEmailAndStatus(String email, ReportStatus status);
}
