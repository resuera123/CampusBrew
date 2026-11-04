package com.campusbrew.campusbrew_api.service;

import com.campusbrew.campusbrew_api.dto.SupportTicketDTO;
import com.campusbrew.campusbrew_api.model.ReportStatus;
import com.campusbrew.campusbrew_api.model.SupportTicket;
import com.campusbrew.campusbrew_api.repository.SupportTicketRepository;
import com.campusbrew.campusbrew_api.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Date;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Contact Support from the login screen (no account needed, so suspended users
 * can appeal) and the admin's support queue.
 */
@Service
@RequiredArgsConstructor
public class SupportService {

    private static final Pattern EMAIL = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");
    private static final Set<String> TOPICS = Set.of(SupportTicket.APPEAL, SupportTicket.QUESTION, SupportTicket.OTHER);
    /** Keeps one address from flooding the queue; they can send more once these are answered. */
    static final int MAX_OPEN_PER_EMAIL = 3;
    static final int MAX_MESSAGE = 1000;

    private final SupportTicketRepository ticketRepository;
    private final UserRepository userRepository;

    public SupportTicketDTO submit(String email, String name, String topic, String message) {
        String cleanEmail = email == null ? "" : email.trim().toLowerCase();
        if (!EMAIL.matcher(cleanEmail).matches()) {
            throw new IllegalArgumentException("Enter a valid email address");
        }
        String cleanTopic = topic == null ? SupportTicket.OTHER : topic.trim().toUpperCase();
        if (!TOPICS.contains(cleanTopic)) {
            throw new IllegalArgumentException("Pick what your message is about");
        }
        String cleanMessage = message == null ? "" : message.trim();
        if (cleanMessage.length() < 10) {
            throw new IllegalArgumentException("Tell us a little more (at least 10 characters)");
        }
        if (cleanMessage.length() > MAX_MESSAGE) {
            throw new IllegalArgumentException("Keep your message under " + MAX_MESSAGE + " characters");
        }
        if (ticketRepository.countByEmailAndStatus(cleanEmail, ReportStatus.OPEN) >= MAX_OPEN_PER_EMAIL) {
            throw new IllegalArgumentException("You already have messages waiting for a reply. We'll get back to you soon.");
        }

        SupportTicket ticket = ticketRepository.save(SupportTicket.builder()
                .email(cleanEmail)
                .name(name == null || name.isBlank() ? null : name.trim())
                .userId(userRepository.findByEmail(cleanEmail).map(u -> u.getId()).orElse(null))
                .topic(cleanTopic)
                .message(cleanMessage)
                .status(ReportStatus.OPEN)
                .createdAt(new Date())
                .build());
        return dto(ticket);
    }

    // ─── Admin ──────────────────────────────────────────────────

    public List<SupportTicketDTO> list(ReportStatus status) {
        List<SupportTicket> tickets = status == null
                ? ticketRepository.findAllByOrderByCreatedAtDesc()
                : ticketRepository.findByStatusOrderByCreatedAtDesc(status);
        return tickets.stream().map(this::dto).toList();
    }

    public SupportTicketDTO get(String id) {
        return dto(require(id));
    }

    public SupportTicketDTO resolve(String adminId, String id) {
        SupportTicket t = require(id);
        if (t.getStatus() != ReportStatus.RESOLVED) {
            t.setStatus(ReportStatus.RESOLVED);
            t.setResolvedBy(adminId);
            t.setResolvedAt(new Date());
            ticketRepository.save(t);
        }
        return dto(t);
    }

    private SupportTicketDTO dto(SupportTicket t) {
        // Look the account up again: it may have been created or suspended since.
        return SupportTicketDTO.from(t, userRepository.findByEmail(t.getEmail()).orElse(null));
    }

    private SupportTicket require(String id) {
        return ticketRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Support message not found"));
    }
}
