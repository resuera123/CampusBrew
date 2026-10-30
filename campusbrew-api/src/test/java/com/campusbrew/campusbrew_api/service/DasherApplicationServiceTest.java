package com.campusbrew.campusbrew_api.service;

import com.campusbrew.campusbrew_api.dto.DasherApplicationRequest;
import com.campusbrew.campusbrew_api.dto.DasherStatusDTO;
import com.campusbrew.campusbrew_api.model.ApplicationStatus;
import com.campusbrew.campusbrew_api.model.DasherApplication;
import com.campusbrew.campusbrew_api.model.DeliveryPersonnel;
import com.campusbrew.campusbrew_api.model.User;
import com.campusbrew.campusbrew_api.model.UserRole;
import com.campusbrew.campusbrew_api.model.VerificationStatus;
import com.campusbrew.campusbrew_api.repository.DasherApplicationRepository;
import com.campusbrew.campusbrew_api.repository.DeliveryPersonnelRepository;
import com.campusbrew.campusbrew_api.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** Become a Dasher: who may apply, what the form must contain, and what approval grants. */
class DasherApplicationServiceTest {

    private DasherApplicationRepository appRepo;
    private UserRepository userRepo;
    private DeliveryPersonnelRepository dpRepo;
    private DasherApplicationService service;
    private User customer;

    @BeforeEach
    void setUp() {
        appRepo = mock(DasherApplicationRepository.class);
        userRepo = mock(UserRepository.class);
        dpRepo = mock(DeliveryPersonnelRepository.class);
        service = new DasherApplicationService(appRepo, userRepo, dpRepo, mock(PushNotificationService.class));

        customer = User.builder().id("c1").fullName("Craig").role(UserRole.CUSTOMER)
                .verificationStatus(VerificationStatus.VERIFIED).build();
        when(userRepo.findById("c1")).thenReturn(Optional.of(customer));
        when(appRepo.findByUserIdNewestFirst("c1")).thenReturn(List.of());
        when(appRepo.save(any(DasherApplication.class))).thenAnswer(i -> i.getArgument(0));
        when(dpRepo.findByUserId("c1")).thenReturn(Optional.empty());
    }

    static DasherApplicationRequest valid() {
        DasherApplicationRequest r = new DasherApplicationRequest();
        r.setPhoneNumber("09171234567");
        r.setReason("I'm on campus all day and want to earn between classes.");
        r.setCourse("BSIT");
        r.setYearLevel(3);
        r.setEmergencyName("Maria Salgado");
        r.setEmergencyRelationship("Mother");
        r.setEmergencyPhone("09181234567");
        r.setAgreedToRules(true);
        r.setIdPhoto("data:image/jpeg;base64,AAA");
        r.setSelfiePhoto("data:image/jpeg;base64,BBB");
        r.setCorPhoto("data:image/jpeg;base64,CCC");
        return r;
    }

    @Test
    void verifiedCustomerCanApply() {
        service.apply("c1", valid());
        verify(appRepo).save(argThat(a -> a.getStatus() == ApplicationStatus.PENDING && a.isAgreedToRules()));
    }

    @Test
    void unverifiedCustomerCannotApply() {
        customer.setVerificationStatus(VerificationStatus.UNVERIFIED);
        assertThatThrownBy(() -> service.apply("c1", valid())).hasMessageContaining("Verify");
    }

    @Test
    void cannotApplyTwiceWhilePending() {
        when(appRepo.existsByUserIdAndStatus("c1", ApplicationStatus.PENDING)).thenReturn(true);
        assertThatThrownBy(() -> service.apply("c1", valid())).hasMessageContaining("under review");
    }

    @Test
    void formRules() {
        DasherApplicationRequest r = valid();
        r.setPhoneNumber("12345");
        assertThatThrownBy(() -> DasherApplicationService.validate(r)).hasMessageContaining("mobile number");

        DasherApplicationRequest shortReason = valid();
        shortReason.setReason("money");
        assertThatThrownBy(() -> DasherApplicationService.validate(shortReason)).hasMessageContaining("20 to 500");

        DasherApplicationRequest sameNumber = valid();
        sameNumber.setEmergencyPhone(sameNumber.getPhoneNumber());
        assertThatThrownBy(() -> DasherApplicationService.validate(sameNumber)).hasMessageContaining("different number");

        DasherApplicationRequest noRules = valid();
        noRules.setAgreedToRules(false);
        assertThatThrownBy(() -> DasherApplicationService.validate(noRules)).hasMessageContaining("code of conduct");

        DasherApplicationRequest noSelfie = valid();
        noSelfie.setSelfiePhoto(null);
        assertThatThrownBy(() -> DasherApplicationService.validate(noSelfie)).hasMessageContaining("selfie");
    }

    @Test
    void approvalGrantsDasherAccessAndAProfile() {
        DasherApplication pending = DasherApplication.builder().id("a1").userId("c1")
                .status(ApplicationStatus.PENDING).build();
        when(appRepo.findById("a1")).thenReturn(Optional.of(pending));

        service.approve("admin", "a1");

        assertThat(customer.isDasherApproved()).isTrue();
        assertThat(customer.getRole()).isEqualTo(UserRole.CUSTOMER); // they switch when they want to
        assertThat(pending.getStatus()).isEqualTo(ApplicationStatus.APPROVED);
        verify(dpRepo).save(any(DeliveryPersonnel.class));
    }

    @Test
    void rejectionNeedsAReasonAndAllowsReapplying() {
        DasherApplication pending = DasherApplication.builder().id("a1").userId("c1")
                .status(ApplicationStatus.PENDING).build();
        when(appRepo.findById("a1")).thenReturn(Optional.of(pending));
        assertThatThrownBy(() -> service.reject("admin", "a1", " ")).hasMessageContaining("reason");

        service.reject("admin", "a1", "COR photo is blurry");
        when(appRepo.findByUserIdNewestFirst("c1")).thenReturn(List.of(pending));
        DasherStatusDTO status = service.status("c1");
        assertThat(status.getApplicationStatus()).isEqualTo(ApplicationStatus.REJECTED);
        assertThat(status.getRejectionReason()).isEqualTo("COR photo is blurry");

        service.apply("c1", valid()); // no pending one left, so they can reapply
    }
}
