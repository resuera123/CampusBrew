package com.campusbrew.campusbrew_api.service;

import com.campusbrew.campusbrew_api.dto.AuthResponse;
import com.campusbrew.campusbrew_api.dto.LoginRequest;
import com.campusbrew.campusbrew_api.dto.RegisterRequest;
import com.campusbrew.campusbrew_api.model.DeliveryPersonnel;
import com.campusbrew.campusbrew_api.model.User;
import com.campusbrew.campusbrew_api.model.UserRole;
import com.campusbrew.campusbrew_api.model.VerificationStatus;
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

/** Customer ⇄ dasher switch, sign-up roles and suspended logins. */
class RoleSwitchTest {

    private UserRepository userRepo;
    private DeliveryPersonnelRepository dpRepo;
    private PasswordEncoder encoder;
    private AuthService service;
    private User user;
    private DeliveryPersonnel dp;

    @BeforeEach
    void setUp() {
        userRepo = mock(UserRepository.class);
        dpRepo = mock(DeliveryPersonnelRepository.class);
        encoder = mock(PasswordEncoder.class);
        JwtService jwt = mock(JwtService.class);
        when(jwt.generateToken(any())).thenReturn("token");
        service = new AuthService(userRepo, mock(OtpRepository.class), mock(ShopRepository.class), dpRepo,
                jwt, mock(EmailService.class), encoder);

        user = User.builder().id("u1").email("u@cit.edu").passwordHash("hash").role(UserRole.CUSTOMER)
                .verificationStatus(VerificationStatus.VERIFIED).emailVerified(true).build();
        dp = DeliveryPersonnel.builder().userId("u1").isActive(true).build();
        when(userRepo.findById("u1")).thenReturn(Optional.of(user));
        when(userRepo.save(any(User.class))).thenAnswer(i -> i.getArgument(0));
        when(dpRepo.findByUserId("u1")).thenReturn(Optional.of(dp));
    }

    @Test
    void approvedCustomerSwitchesToDasherAndBack() {
        user.setDasherApproved(true);

        AuthResponse asDasher = service.switchRole("u1", UserRole.DELIVERY_PERSONNEL);
        assertThat(asDasher.getRole()).isEqualTo(UserRole.DELIVERY_PERSONNEL);
        assertThat(asDasher.isDasherApproved()).isTrue();

        AuthResponse asCustomer = service.switchRole("u1", UserRole.CUSTOMER);
        assertThat(asCustomer.getRole()).isEqualTo(UserRole.CUSTOMER);
        assertThat(dp.isActive()).isFalse(); // no offers while ordering
    }

    @Test
    void unapprovedCustomerCannotSwitch() {
        assertThatThrownBy(() -> service.switchRole("u1", UserRole.DELIVERY_PERSONNEL))
                .hasMessageContaining("approved");
    }

    @Test
    void legacyDasherCanSwitchToCustomer() {
        user.setRole(UserRole.DELIVERY_PERSONNEL);
        assertThat(service.switchRole("u1", UserRole.CUSTOMER).getRole()).isEqualTo(UserRole.CUSTOMER);
        assertThat(user.isDasherApproved()).isTrue();
    }

    @Test
    void cannotSwitchToCustomerMidDelivery() {
        user.setRole(UserRole.DELIVERY_PERSONNEL);
        dp.setCurrentOrderId("o1");
        assertThatThrownBy(() -> service.switchRole("u1", UserRole.CUSTOMER))
                .hasMessageContaining("current delivery");
    }

    @Test
    void cannotSwitchToShopOrAdmin() {
        user.setDasherApproved(true);
        assertThatThrownBy(() -> service.switchRole("u1", UserRole.ADMIN)).hasMessageContaining("only switch");
    }

    @Test
    void signUpOnlyAllowsCustomersAndShops() {
        RegisterRequest r = new RegisterRequest();
        r.setEmail("new@cit.edu");
        r.setRole(UserRole.DELIVERY_PERSONNEL);
        assertThatThrownBy(() -> service.register(r)).hasMessageContaining("customer or shop");
        r.setRole(UserRole.ADMIN);
        assertThatThrownBy(() -> service.register(r)).hasMessageContaining("customer or shop");
    }

    @Test
    void suspendedAccountCannotLogIn() {
        user.setSuspended(true);
        when(userRepo.findByEmail("u@cit.edu")).thenReturn(Optional.of(user));
        when(encoder.matches("pw", "hash")).thenReturn(true);
        LoginRequest login = new LoginRequest();
        login.setEmail("u@cit.edu");
        login.setPassword("pw");
        assertThatThrownBy(() -> service.login(login)).hasMessageContaining("suspended");
    }
}
