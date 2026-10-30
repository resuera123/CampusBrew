package com.campusbrew.campusbrew_api.config;

import com.campusbrew.campusbrew_api.model.User;
import com.campusbrew.campusbrew_api.model.UserRole;
import com.campusbrew.campusbrew_api.model.VerificationStatus;
import com.campusbrew.campusbrew_api.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.Date;

/**
 * Creates the default admin account on startup from admin.email / admin.password
 * (ADMIN_EMAIL / ADMIN_PASSWORD on Render). The repo is public, so the password
 * is never in code. An existing account with that email is left as it is.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AdminSeeder implements ApplicationRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${admin.email:}")
    private String email;

    @Value("${admin.password:}")
    private String password;

    @Override
    public void run(ApplicationArguments args) {
        if (email.isBlank() || password.isBlank()) {
            log.info("Admin seeding skipped: admin.email / admin.password not set");
            return;
        }
        if (userRepository.existsByEmail(email)) return;

        Date now = new Date();
        userRepository.save(User.builder()
                .fullName("CampusBrew Admin")
                .email(email)
                .passwordHash(passwordEncoder.encode(password))
                .role(UserRole.ADMIN)
                .verificationStatus(VerificationStatus.VERIFIED)
                .emailVerified(true)
                .createdAt(now)
                .updatedAt(now)
                .build());
        log.info("Created the default admin account {}", email);
    }
}
