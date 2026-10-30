package com.campusbrew.campusbrew_api.service;

import com.campusbrew.campusbrew_api.dto.ReportDTO;
import com.campusbrew.campusbrew_api.model.ChatChannel;
import com.campusbrew.campusbrew_api.model.ChatMessage;
import com.campusbrew.campusbrew_api.model.DeliveryPersonnel;
import com.campusbrew.campusbrew_api.model.Report;
import com.campusbrew.campusbrew_api.model.ReportStatus;
import com.campusbrew.campusbrew_api.model.ReportType;
import com.campusbrew.campusbrew_api.model.User;
import com.campusbrew.campusbrew_api.model.UserRole;
import com.campusbrew.campusbrew_api.repository.ChatMessageRepository;
import com.campusbrew.campusbrew_api.repository.DeliveryPersonnelRepository;
import com.campusbrew.campusbrew_api.repository.OrderRepository;
import com.campusbrew.campusbrew_api.repository.PaymentRepository;
import com.campusbrew.campusbrew_api.repository.ReportRepository;
import com.campusbrew.campusbrew_api.repository.ShopRepository;
import com.campusbrew.campusbrew_api.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** Admin report review and suspensions. */
class AdminServiceTest {

    private ReportRepository reportRepo;
    private ChatMessageRepository chatRepo;
    private UserRepository userRepo;
    private DeliveryPersonnelRepository dpRepo;
    private ChatService chatService;
    private AdminService service;

    private final User customer = User.builder().id("c1").fullName("Craig").role(UserRole.CUSTOMER).build();
    private final User dasher = User.builder().id("d1").fullName("Dana").role(UserRole.DELIVERY_PERSONNEL).build();

    @BeforeEach
    void setUp() {
        reportRepo = mock(ReportRepository.class);
        chatRepo = mock(ChatMessageRepository.class);
        userRepo = mock(UserRepository.class);
        dpRepo = mock(DeliveryPersonnelRepository.class);
        chatService = mock(ChatService.class);
        service = new AdminService(reportRepo, chatRepo, mock(PaymentRepository.class), mock(OrderRepository.class),
                mock(ShopRepository.class), userRepo, dpRepo, chatService);

        when(userRepo.findById("c1")).thenReturn(Optional.of(customer));
        when(userRepo.findById("d1")).thenReturn(Optional.of(dasher));
        when(userRepo.findAllById(any())).thenReturn(List.of(customer, dasher));
        when(userRepo.save(any(User.class))).thenAnswer(i -> i.getArgument(0));
    }

    @Test
    void chatReportShowsTheConversationAndBothPeople() {
        Report r = Report.builder().id("r1").type(ReportType.CHAT).reporterId("c1")
                .orderId("o1").channel(ChatChannel.DASHER).status(ReportStatus.OPEN).build();
        when(reportRepo.findById("r1")).thenReturn(Optional.of(r));
        when(chatService.participantIds("o1", ChatChannel.DASHER)).thenReturn(List.of("c1", "d1"));
        when(chatRepo.findByOrderIdAndChannelOrderByCreatedAtAsc("o1", ChatChannel.DASHER)).thenReturn(List.of(
                ChatMessage.builder().senderId("d1").senderRole("DELIVERY_PERSONNEL").text("hurry up").build()));

        ReportDTO dto = service.report("r1");

        assertThat(dto.getMessages()).extracting(ReportDTO.Message::getSenderName).containsExactly("Dana");
        assertThat(dto.getPeople()).extracting(ReportDTO.Person::getName).containsExactly("Craig", "Dana");
        assertThat(dto.getPeople().get(0).isReporter()).isTrue();
    }

    @Test
    void suspendingADasherTakesThemOffline() {
        DeliveryPersonnel dp = DeliveryPersonnel.builder().userId("d1").isActive(true).build();
        when(dpRepo.findByUserId("d1")).thenReturn(Optional.of(dp));

        service.suspend("admin", "d1", "Abusive chat");

        assertThat(dasher.isSuspended()).isTrue();
        assertThat(dasher.getSuspendedReason()).isEqualTo("Abusive chat");
        assertThat(dp.isActive()).isFalse();

        service.unsuspend("d1");
        assertThat(dasher.isSuspended()).isFalse();
    }

    @Test
    void adminsCannotBeSuspended() {
        User admin = User.builder().id("a2").role(UserRole.ADMIN).build();
        when(userRepo.findById("a2")).thenReturn(Optional.of(admin));
        assertThatThrownBy(() -> service.suspend("admin", "a2", null)).hasMessageContaining("Admin");
    }
}
