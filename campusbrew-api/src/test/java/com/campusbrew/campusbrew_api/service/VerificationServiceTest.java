package com.campusbrew.campusbrew_api.service;

import com.campusbrew.campusbrew_api.dto.VerificationStatusDTO;
import com.campusbrew.campusbrew_api.model.ApplicationStatus;
import com.campusbrew.campusbrew_api.model.Otp;
import com.campusbrew.campusbrew_api.model.OtpType;
import com.campusbrew.campusbrew_api.model.User;
import com.campusbrew.campusbrew_api.model.UserRole;
import com.campusbrew.campusbrew_api.model.VerificationApplication;
import com.campusbrew.campusbrew_api.model.VerificationStatus;
import com.campusbrew.campusbrew_api.repository.OtpRepository;
import com.campusbrew.campusbrew_api.repository.UserRepository;
import com.campusbrew.campusbrew_api.repository.VerificationApplicationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** CIT-U verification: the email code and student ID go to an admin, who approves or rejects. */
class VerificationServiceTest {

    private UserRepository userRepo;
    private VerificationApplicationRepository appRepo;
    private VerificationService service;
    private User user;
    private final List<VerificationApplication> saved = new ArrayList<>();

    @BeforeEach
    void setUp() {
        userRepo = mock(UserRepository.class);
        appRepo = mock(VerificationApplicationRepository.class);
        OtpRepository otpRepo = mock(OtpRepository.class);
        service = new VerificationService(userRepo, otpRepo, mock(EmailService.class), appRepo,
                mock(PushNotificationService.class));

        user = User.builder().id("u1").fullName("Ana").role(UserRole.CUSTOMER)
                .verificationStatus(VerificationStatus.UNVERIFIED).build();
        when(userRepo.findById("u1")).thenReturn(Optional.of(user));
        when(userRepo.findByStudentId(any())).thenReturn(Optional.empty());
        when(appRepo.save(any(VerificationApplication.class))).thenAnswer(i -> {
            VerificationApplication a = i.getArgument(0);
            if (a.getId() == null) a.setId("v" + saved.size());
            saved.add(a);
            return a;
        });
        when(appRepo.findByUserIdOrderByCreatedAtDesc("u1")).thenAnswer(i -> saved.isEmpty()
                ? List.of() : List.of(saved.get(saved.size() - 1)));
        when(otpRepo.findFirstByEmailAndTypeOrderByCreatedAtDesc("ana@cit.edu", OtpType.VERIFICATION))
                .thenReturn(Optional.of(Otp.builder().code("123456").expiresAt(Instant.now().plusSeconds(60)).build()));
    }

    @Test
    void aCorrectCodeSendsTheRequestForReviewInsteadOfVerifying() {
        VerificationStatusDTO status = service.verify("u1", "ana@cit.edu", "123456", "23-1234-567");

        assertThat(user.getVerificationStatus()).isEqualTo(VerificationStatus.PENDING);
        assertThat(user.getStudentId()).isNull(); // only copied on approval
        assertThat(status.getApplicationStatus()).isEqualTo(ApplicationStatus.PENDING);
        assertThat(saved.get(0).getStudentId()).isEqualTo("23-1234-567");
    }

    @Test
    void approvalVerifiesTheAccount() {
        service.verify("u1", "ana@cit.edu", "123456", "23-1234-567");
        when(appRepo.findById("v0")).thenReturn(Optional.of(saved.get(0)));

        service.approve("admin", "v0");

        assertThat(user.getVerificationStatus()).isEqualTo(VerificationStatus.VERIFIED);
        assertThat(user.getStudentId()).isEqualTo("23-1234-567");
        assertThat(user.getSchoolEmail()).isEqualTo("ana@cit.edu");
        assertThat(saved.get(0).getStatus()).isEqualTo(ApplicationStatus.APPROVED);
    }

    @Test
    void rejectionNeedsAReasonAndLetsThemTryAgain() {
        service.verify("u1", "ana@cit.edu", "123456", "23-1234-567");
        when(appRepo.findById("v0")).thenReturn(Optional.of(saved.get(0)));

        assertThatThrownBy(() -> service.reject("admin", "v0", " ")).hasMessageContaining("reason");
        service.reject("admin", "v0", "Student ID doesn't match");

        assertThat(user.getVerificationStatus()).isEqualTo(VerificationStatus.UNVERIFIED);
        VerificationStatusDTO status = service.status("u1");
        assertThat(status.getRejectionReason()).isEqualTo("Student ID doesn't match");
        assertThat(status.getStudentId()).isEqualTo("23-1234-567"); // prefilled for the retry
    }

    @Test
    void cantResendWhileUnderReviewOrOnceVerified() {
        user.setVerificationStatus(VerificationStatus.PENDING);
        assertThatThrownBy(() -> service.sendSchoolOtp("u1", "ana@cit.edu")).hasMessageContaining("under review");
        user.setVerificationStatus(VerificationStatus.VERIFIED);
        assertThatThrownBy(() -> service.verify("u1", "ana@cit.edu", "123456", "23-1234-567"))
                .hasMessageContaining("already verified");
    }

    @Test
    void aStudentIdWaitingOnAnotherAccountIsRefused() {
        when(appRepo.existsByStudentIdAndStatusAndUserIdNot("23-1234-567", ApplicationStatus.PENDING, "u1"))
                .thenReturn(true);
        assertThatThrownBy(() -> service.verify("u1", "ana@cit.edu", "123456", "23-1234-567"))
                .hasMessageContaining("another account");
        verify(userRepo, never()).save(any());
    }

    @Test
    void approvalIsRefusedIfSomeoneElseGotVerifiedWithTheIdMeanwhile() {
        service.verify("u1", "ana@cit.edu", "123456", "23-1234-567");
        when(appRepo.findById("v0")).thenReturn(Optional.of(saved.get(0)));
        when(userRepo.findByStudentId("23-1234-567")).thenReturn(Optional.of(
                User.builder().id("u2").verificationStatus(VerificationStatus.VERIFIED).build()));

        assertThatThrownBy(() -> service.approve("admin", "v0")).hasMessageContaining("another account");
        ArgumentCaptor<User> users = ArgumentCaptor.forClass(User.class);
        verify(userRepo, atLeastOnce()).save(users.capture());
        assertThat(user.getVerificationStatus()).isEqualTo(VerificationStatus.PENDING);
    }
}
