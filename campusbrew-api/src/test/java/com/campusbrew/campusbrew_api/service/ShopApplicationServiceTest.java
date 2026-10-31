package com.campusbrew.campusbrew_api.service;

import com.campusbrew.campusbrew_api.dto.ShopApplicationRequest;
import com.campusbrew.campusbrew_api.dto.ShopApprovalStatusDTO;
import com.campusbrew.campusbrew_api.dto.ShopDTO;
import com.campusbrew.campusbrew_api.dto.UpdateShopDTO;
import com.campusbrew.campusbrew_api.model.ApplicationStatus;
import com.campusbrew.campusbrew_api.model.Shop;
import com.campusbrew.campusbrew_api.model.ShopApplication;
import com.campusbrew.campusbrew_api.model.User;
import com.campusbrew.campusbrew_api.model.UserRole;
import com.campusbrew.campusbrew_api.repository.MenuItemRepository;
import com.campusbrew.campusbrew_api.repository.OrderRepository;
import com.campusbrew.campusbrew_api.repository.ShopApplicationRepository;
import com.campusbrew.campusbrew_api.repository.ShopRepository;
import com.campusbrew.campusbrew_api.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** Shop approval: new shops stay hidden and closed until an admin approves their application. */
class ShopApplicationServiceTest {

    private ShopApplicationRepository appRepo;
    private ShopRepository shopRepo;
    private ShopApplicationService service;
    private ShopService shopService;
    private Shop shop;

    @BeforeEach
    void setUp() {
        appRepo = mock(ShopApplicationRepository.class);
        shopRepo = mock(ShopRepository.class);
        UserRepository userRepo = mock(UserRepository.class);
        service = new ShopApplicationService(appRepo, shopRepo, userRepo, mock(PushNotificationService.class));
        shopService = new ShopService(shopRepo, mock(MenuItemRepository.class), userRepo,
                mock(OrderRepository.class), mock(ConfigService.class));

        shop = Shop.builder().id("s1").operatorId("op").shopName("Craig's Shop").approved(false).build();
        when(userRepo.findById("op")).thenReturn(Optional.of(
                User.builder().id("op").fullName("Craig").role(UserRole.SHOP_OPERATOR).build()));
        when(shopRepo.findByOperatorId("op")).thenReturn(List.of(shop));
        when(shopRepo.findById("s1")).thenReturn(Optional.of(shop));
        when(shopRepo.save(any(Shop.class))).thenAnswer(i -> i.getArgument(0));
        when(appRepo.save(any(ShopApplication.class))).thenAnswer(i -> i.getArgument(0));
        when(appRepo.findByUserIdNewestFirst("op")).thenReturn(List.of());
    }

    static ShopApplicationRequest valid() {
        ShopApplicationRequest r = new ShopApplicationRequest();
        r.setStallName("Pickup Coffee");
        r.setLocation("GLE Building canteen, stall 4");
        r.setOperatorName("Craig Salgado");
        r.setPhoneNumber("09171234567");
        r.setAgreedToRules(true);
        r.setStallPhoto("data:image/jpeg;base64,AAA");
        r.setIdPhoto("data:image/jpeg;base64,BBB");
        return r;
    }

    @Test
    void newShopIsHiddenAndCannotOpen() {
        Shop legacy = Shop.builder().id("s0").shopName("Old Shop").build(); // approved == null
        when(shopRepo.findAll()).thenReturn(List.of(shop, legacy));
        assertThat(shopService.getAllShops(null)).extracting(ShopDTO::getId).containsExactly("s0");

        UpdateShopDTO open = new UpdateShopDTO();
        open.setIsOpen(true);
        assertThatThrownBy(() -> shopService.updateShop("op", "s1", open)).hasMessageContaining("approval");
    }

    @Test
    void operatorAppliesAndAdminApproves() {
        service.apply("op", valid());
        verify(appRepo).save(argThat(a -> a.getStatus() == ApplicationStatus.PENDING && "s1".equals(a.getShopId())));

        ShopApplication pending = ShopApplication.builder().id("a1").userId("op").shopId("s1")
                .stallName("Pickup Coffee").location("GLE Building canteen, stall 4")
                .status(ApplicationStatus.PENDING).build();
        when(appRepo.findById("a1")).thenReturn(Optional.of(pending));
        service.approve("admin", "a1");

        assertThat(shop.isApprovedShop()).isTrue();
        assertThat(shop.getShopName()).isEqualTo("Pickup Coffee");
        assertThat(shop.getLocation()).isEqualTo("GLE Building canteen, stall 4");
        assertThat(pending.getStatus()).isEqualTo(ApplicationStatus.APPROVED);
    }

    @Test
    void rejectionNeedsAReasonAndShowsIt() {
        ShopApplication pending = ShopApplication.builder().id("a1").userId("op").shopId("s1")
                .status(ApplicationStatus.PENDING).build();
        when(appRepo.findById("a1")).thenReturn(Optional.of(pending));
        assertThatThrownBy(() -> service.reject("admin", "a1", "")).hasMessageContaining("reason");

        service.reject("admin", "a1", "Stall photo doesn't show the signage");
        when(appRepo.findByUserIdNewestFirst("op")).thenReturn(List.of(pending));
        ShopApprovalStatusDTO status = service.status("op");
        assertThat(status.isApproved()).isFalse();
        assertThat(status.getRejectionReason()).isEqualTo("Stall photo doesn't show the signage");
    }

    @Test
    void cannotApplyTwiceWhilePending() {
        when(appRepo.existsByUserIdAndStatus("op", ApplicationStatus.PENDING)).thenReturn(true);
        assertThatThrownBy(() -> service.apply("op", valid())).hasMessageContaining("under review");
    }

    @Test
    void formRules() {
        ShopApplicationRequest noId = valid();
        noId.setIdPhoto(null);
        assertThatThrownBy(() -> ShopApplicationService.validate(noId)).hasMessageContaining("valid ID");

        ShopApplicationRequest badPhone = valid();
        badPhone.setPhoneNumber("123");
        assertThatThrownBy(() -> ShopApplicationService.validate(badPhone)).hasMessageContaining("mobile");

        ShopApplicationRequest noRules = valid();
        noRules.setAgreedToRules(false);
        assertThatThrownBy(() -> ShopApplicationService.validate(noRules)).hasMessageContaining("shop rules");
    }
}
