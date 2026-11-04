package com.campusbrew.campusbrew_api.repository;

import com.campusbrew.campusbrew_api.model.ApplicationStatus;
import com.campusbrew.campusbrew_api.model.VerificationApplication;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Date;
import java.util.List;

@Repository
public interface VerificationApplicationRepository extends MongoRepository<VerificationApplication, String> {

    List<VerificationApplication> findByUserIdOrderByCreatedAtDesc(String userId);

    List<VerificationApplication> findByStatusOrderByCreatedAtAsc(ApplicationStatus status);

    List<VerificationApplication> findAllByOrderByCreatedAtDesc();

    boolean existsByStudentIdAndStatusAndUserIdNot(String studentId, ApplicationStatus status, String userId);

    long countByUserIdAndCreatedAtBefore(String userId, Date createdAt);
}
