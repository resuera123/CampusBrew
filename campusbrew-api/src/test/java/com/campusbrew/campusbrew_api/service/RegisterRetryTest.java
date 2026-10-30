package com.campusbrew.campusbrew_api.service;

import com.campusbrew.campusbrew_api.dto.RegisterRequest;
import com.campusbrew.campusbrew_api.model.User;
import com.campusbrew.campusbrew_api.model.UserRole;
import com.campusbrew.campusbrew_api.repository.DeliveryPersonnelRepository;
import com.campusbrew.campusbrew_api.repository.OtpRepository;
import com.campusbrew.campusbrew_api.repository.ShopRepository;
import com.campusbrew.campusbrew_api.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** Sign-up can be retried for an address whose verification never finished. */
class RegisterRetryTest {

    private UserRepository userRepo;
    private AuthService service;

    @BeforeEach
    void setUp() {
        userRepo = mock(UserRepository.class);
        PasswordEncoder encoder = mock(PasswordEncoder.class);
        when(encoder.encode(any())).thenAnswer(i -> "hash:" + i.getArgument(0));
        when(userRepo.save(any(User.class))).thenAnswer(i -> i.getArgument(0));
        service = new AuthService(userRepo, mock(OtpRepository.class), mock(ShopRepository.class),
                mock(DeliveryPersonnelRepository.class), mock(JwtService.class), mock(EmailService.class), encoder);
    }

    private static RegisterRequest request() {
        RegisterRequest r = new RegisterRequest();
        r.setFullName("Craig Salgado");
        r.setEmail("craig@gmail.com");
        r.setPassword("new-password");
        r.setRole(UserRole.CUSTOMER);
        return r;
    }

    @Test
    void unverifiedAddressCanSignUpAgain() {
        User stuck = User.builder().id("u1").email("craig@gmail.com").fullName("Old").passwordHash("old")
                .role(UserRole.CUSTOMER).emailVerified(false).build();
        when(userRepo.findByEmail("craig@gmail.com")).thenReturn(Optional.of(stuck));

        service.register(request());

        assertThat(stuck.getFullName()).isEqualTo("Craig Salgado");
        assertThat(stuck.getPasswordHash()).isEqualTo("hash:new-password");
        verify(userRepo).save(stuck); // same account, not a second one
    }

    @Test
    void verifiedAddressIsStillTaken() {
        when(userRepo.findByEmail("craig@gmail.com")).thenReturn(Optional.of(
                User.builder().id("u1").email("craig@gmail.com").emailVerified(true).build()));
        assertThatThrownBy(() -> service.register(request())).hasMessageContaining("already registered");
    }
}
