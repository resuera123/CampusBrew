package com.campusbrew.campusbrew_api.repository;

import com.campusbrew.campusbrew_api.model.ChatChannel;
import com.campusbrew.campusbrew_api.model.Report;
import com.campusbrew.campusbrew_api.model.ReportStatus;
import com.campusbrew.campusbrew_api.model.ReportType;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ReportRepository extends MongoRepository<Report, String> {

    List<Report> findByStatusOrderByCreatedAtDesc(ReportStatus status);

    List<Report> findAllByOrderByCreatedAtDesc();

    boolean existsByTypeAndOrderIdAndChannelAndStatus(
            ReportType type, String orderId, ChatChannel channel, ReportStatus status);

    boolean existsByTypeAndPaymentIdAndStatus(ReportType type, String paymentId, ReportStatus status);
}
