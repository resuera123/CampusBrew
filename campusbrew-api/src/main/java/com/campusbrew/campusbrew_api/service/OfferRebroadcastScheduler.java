package com.campusbrew.campusbrew_api.service;

import com.campusbrew.campusbrew_api.model.Order;
import com.campusbrew.campusbrew_api.model.OrderStatus;
import com.campusbrew.campusbrew_api.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.Date;
import java.util.List;

/**
 * v2.0 FR-3.2 — re-broadcasts an unclaimed offer to all active dashers (ignoring
 * pickup range) once its 60s window has lapsed. Runs every 15s; the rebroadcastAt
 * flag on the order makes the re-broadcast fire exactly once.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OfferRebroadcastScheduler {

    private final OrderRepository orderRepository;
    private final DeliveryAssignmentEngine assignmentEngine;
    private final ConfigService configService;

    @Scheduled(fixedDelayString = "15000")
    public void sweep() {
        Date cutoff = new Date(System.currentTimeMillis()
                - configService.getOfferRebroadcastSeconds() * 1000L);
        List<Order> due = orderRepository
                .findByOrderStatusAndDeliveryPersonnelIdIsNullAndRebroadcastAtIsNullAndReadyAtLessThan(
                        OrderStatus.READY_FOR_PICKUP, cutoff);
        if (due.isEmpty()) return;
        log.info("Re-broadcasting {} unclaimed offer(s) past the {}s window",
                due.size(), configService.getOfferRebroadcastSeconds());
        due.forEach(assignmentEngine::rebroadcastToAll);
    }
}
