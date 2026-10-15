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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** v2.0 FR-3.1 — pickup range validation and persistence. */
class PickupRangeTest {

    private DeliveryPersonnelRepository dpRepo;
    private UserRepository userRepo;
    private DeliveryPersonnelService service;

    @BeforeEach
    void setUp() {
        dpRepo = mock(DeliveryPersonnelRepository.class);
        userRepo = mock(UserRepository.class);
        TransactionRepository txRepo = mock(TransactionRepository.class);
        service = new DeliveryPersonnelService(dpRepo, userRepo, txRepo);

        when(userRepo.findById("d1")).thenReturn(Optional.of(
                User.builder().id("d1").role(UserRole.DELIVERY_PERSONNEL).build()));
        when(dpRepo.findByUserId("d1")).thenReturn(Optional.of(
                DeliveryPersonnel.builder().userId("d1").build()));
        when(dpRepo.save(any(DeliveryPersonnel.class))).thenAnswer(i -> i.getArgument(0));
    }

    @Test
    void setsAValidRange() {
        DeliveryPersonnelDTO dto = service.updatePickupRange("d1", 400);
        assertThat(dto.getPickupRangeMeters()).isEqualTo(400);
    }

    @Test
    void nullRestoresCampusDefault() {
        DeliveryPersonnelDTO dto = service.updatePickupRange("d1", null);
        assertThat(dto.getPickupRangeMeters()).isNull();
    }

    @Test
    void rejectsNonPositiveOrTooLarge() {
        assertThatThrownBy(() -> service.updatePickupRange("d1", 0)).isInstanceOf(RuntimeException.class);
        assertThatThrownBy(() -> service.updatePickupRange("d1", 50000)).isInstanceOf(RuntimeException.class);
    }
}
