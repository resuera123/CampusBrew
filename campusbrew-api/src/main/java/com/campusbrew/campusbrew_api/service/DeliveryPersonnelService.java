package com.campusbrew.campusbrew_api.service;

import com.campusbrew.campusbrew_api.dto.DeliveryPersonnelDTO;
import com.campusbrew.campusbrew_api.model.DaySchedule;
import com.campusbrew.campusbrew_api.model.DeliveryPersonnel;
import com.campusbrew.campusbrew_api.model.User;
import com.campusbrew.campusbrew_api.model.UserRole;
import com.campusbrew.campusbrew_api.repository.DeliveryPersonnelRepository;
import com.campusbrew.campusbrew_api.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.mongodb.core.geo.GeoJsonPoint;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Date;
import java.util.List;

@Service
@RequiredArgsConstructor
public class DeliveryPersonnelService {

    private final DeliveryPersonnelRepository deliveryPersonnelRepository;
    private final UserRepository userRepository;

    public DeliveryPersonnelDTO getMyProfile(String userId) {
        return DeliveryPersonnelDTO.fromEntity(requireProfile(userId));
    }

    public DeliveryPersonnelDTO setAvailability(String userId, boolean isActive) {
        DeliveryPersonnel dp = requireProfile(userId);
        // Per SDD §3.1: prevent going inactive while a delivery is in flight.
        if (!isActive && dp.getCurrentOrderId() != null) {
            throw new RuntimeException("Complete your current delivery before going inactive");
        }
        dp.setActive(isActive);
        dp.setUpdatedAt(Date.from(Instant.now()));
        return DeliveryPersonnelDTO.fromEntity(deliveryPersonnelRepository.save(dp));
    }

    public DeliveryPersonnelDTO updateSchedule(String userId, List<DaySchedule> schedule) {
        DeliveryPersonnel dp = requireProfile(userId);
        dp.setWeeklySchedule(schedule);
        dp.setUpdatedAt(Date.from(Instant.now()));
        return DeliveryPersonnelDTO.fromEntity(deliveryPersonnelRepository.save(dp));
    }

    public DeliveryPersonnelDTO updateLocation(String userId, double longitude, double latitude) {
        DeliveryPersonnel dp = requireProfile(userId);
        // GeoJSON Point coordinates are [longitude, latitude] — the constructor matches that order.
        dp.setCurrentLocation(new GeoJsonPoint(longitude, latitude));
        Date now = Date.from(Instant.now());
        dp.setLocationUpdatedAt(now);
        dp.setUpdatedAt(now);
        return DeliveryPersonnelDTO.fromEntity(deliveryPersonnelRepository.save(dp));
    }

    /**
     * Loads the DP profile for this user, creating a blank one on the fly if the
     * user is a DELIVERY_PERSONNEL but the doc is missing (covers accounts that
     * pre-date Wave A's auto-provision).
     */
    private DeliveryPersonnel requireProfile(String userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        if (user.getRole() != UserRole.DELIVERY_PERSONNEL) {
            throw new RuntimeException("Only delivery personnel have a delivery profile");
        }
        return deliveryPersonnelRepository.findByUserId(userId)
                .orElseGet(() -> {
                    Date now = Date.from(Instant.now());
                    return deliveryPersonnelRepository.save(DeliveryPersonnel.builder()
                            .userId(userId)
                            .isActive(false)
                            .totalDeliveries(0)
                            .incentiveActive(false)
                            .createdAt(now)
                            .updatedAt(now)
                            .build());
                });
    }
}
