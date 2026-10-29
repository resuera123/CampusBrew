package com.campusbrew.campusbrew_api.service;

import com.campusbrew.campusbrew_api.dto.DeliveryPersonnelDTO;
import com.campusbrew.campusbrew_api.model.DeliveryPersonnel;
import com.campusbrew.campusbrew_api.model.User;
import com.campusbrew.campusbrew_api.model.UserRole;
import com.campusbrew.campusbrew_api.repository.DeliveryPersonnelRepository;
import com.campusbrew.campusbrew_api.repository.TransactionRepository;
import com.campusbrew.campusbrew_api.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/** v2.0 FR-3.6 — the dasher sees their own rating on their profile, under the same min-count rule. */
class DasherProfileRatingTest {

    private DeliveryPersonnelRepository dpRepo;
    private DeliveryPersonnelService service;

    @BeforeEach
    void setUp() {
        dpRepo = mock(DeliveryPersonnelRepository.class);
        UserRepository userRepo = mock(UserRepository.class);
        ConfigService config = mock(ConfigService.class);
        when(config.getRatingMinCountToShow()).thenReturn(3);
        service = new DeliveryPersonnelService(dpRepo, userRepo, mock(TransactionRepository.class), config);

        when(userRepo.findById("d1")).thenReturn(Optional.of(
                User.builder().id("d1").role(UserRole.DELIVERY_PERSONNEL).build()));
    }

    private void dasherWith(double avg, int count) {
        when(dpRepo.findByUserId("d1")).thenReturn(Optional.of(
                DeliveryPersonnel.builder().userId("d1").ratingAvg(avg).ratingCount(count).build()));
    }

    @Test
    void showsAverageOnceEnoughRatings() {
        dasherWith(4.67, 3);
        DeliveryPersonnelDTO dto = service.getMyProfile("d1");
        assertThat(dto.getRatingAvg()).isEqualTo(4.67);
        assertThat(dto.getRatingCount()).isEqualTo(3);
    }

    @Test
    void hidesAverageBelowMinimumButKeepsCount() {
        dasherWith(5.0, 2);
        DeliveryPersonnelDTO dto = service.getMyProfile("d1");
        assertThat(dto.getRatingAvg()).isNull();
        assertThat(dto.getRatingCount()).isEqualTo(2);
    }
}
