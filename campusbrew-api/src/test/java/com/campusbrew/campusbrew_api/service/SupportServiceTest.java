package com.campusbrew.campusbrew_api.service;

import com.campusbrew.campusbrew_api.dto.SupportTicketDTO;
import com.campusbrew.campusbrew_api.model.ReportStatus;
import com.campusbrew.campusbrew_api.model.SupportTicket;
import com.campusbrew.campusbrew_api.model.User;
import com.campusbrew.campusbrew_api.repository.SupportTicketRepository;
import com.campusbrew.campusbrew_api.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/** Contact Support from the login screen. */
class SupportServiceTest {

    private SupportTicketRepository repo;
    private UserRepository userRepo;
    private SupportService service;

    @BeforeEach
    void setUp() {
        repo = mock(SupportTicketRepository.class);
        userRepo = mock(UserRepository.class);
        service = new SupportService(repo, userRepo);
        when(repo.save(any(SupportTicket.class))).thenAnswer(i -> i.getArgument(0));
        when(userRepo.findByEmail(anyString())).thenReturn(Optional.empty());
    }

    @Test
    void anAppealIsLinkedToTheSuspendedAccount() {
        User suspended = User.builder().id("u1").fullName("Ben").email("ben@x.com")
                .suspended(true).suspendedReason("Rude in chat").build();
        when(userRepo.findByEmail("ben@x.com")).thenReturn(Optional.of(suspended));

        SupportTicketDTO t = service.submit("  Ben@X.com ", null, "appeal", "Please review my suspension, it was a misunderstanding.");

        assertThat(t.getEmail()).isEqualTo("ben@x.com");
        assertThat(t.getTopic()).isEqualTo(SupportTicket.APPEAL);
        assertThat(t.getStatus()).isEqualTo(ReportStatus.OPEN);
        assertThat(t.getUserId()).isEqualTo("u1");
        assertThat(t.isSuspended()).isTrue();
        assertThat(t.getSuspendedReason()).isEqualTo("Rude in chat");
    }

    @Test
    void validatesTheMessage() {
        assertThatThrownBy(() -> service.submit("nope", null, "QUESTION", "A long enough question"))
                .hasMessageContaining("valid email");
        assertThatThrownBy(() -> service.submit("a@b.co", null, "QUESTION", "short"))
                .hasMessageContaining("at least 10");
        assertThatThrownBy(() -> service.submit("a@b.co", null, "SPAM", "A long enough question"))
                .hasMessageContaining("Pick");
    }

    @Test
    void limitsOpenMessagesPerEmail() {
        when(repo.countByEmailAndStatus("a@b.co", ReportStatus.OPEN)).thenReturn((long) SupportService.MAX_OPEN_PER_EMAIL);
        assertThatThrownBy(() -> service.submit("a@b.co", null, "QUESTION", "A long enough question"))
                .hasMessageContaining("waiting for a reply");
    }
}
