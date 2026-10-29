package com.campusbrew.campusbrew_api.service;

import com.campusbrew.campusbrew_api.dto.ChatHistoryDTO;
import com.campusbrew.campusbrew_api.dto.ChatMessageDTO;
import com.campusbrew.campusbrew_api.model.ChatChannel;
import com.campusbrew.campusbrew_api.model.ChatMessage;
import com.campusbrew.campusbrew_api.model.Order;
import com.campusbrew.campusbrew_api.model.OrderStatus;
import com.campusbrew.campusbrew_api.model.Shop;
import com.campusbrew.campusbrew_api.model.StatusHistoryEntry;
import com.campusbrew.campusbrew_api.model.User;
import com.campusbrew.campusbrew_api.repository.ChatMessageRepository;
import com.campusbrew.campusbrew_api.repository.OrderRepository;
import com.campusbrew.campusbrew_api.repository.ShopRepository;
import com.campusbrew.campusbrew_api.repository.UserRepository;
import com.campusbrew.campusbrew_api.websocket.InboundSocketHandler;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * v2.0 FR-3.5 / NFR-S9 — order-scoped in-app chat.
 *
 * Each order has two channels: SHOP (customer ↔ shop operator) and DASHER
 * (customer ↔ assigned dasher). Only the two participants of a channel may read or
 * write it. A channel accepts messages only while it is open:
 *   - SHOP   from PLACED until the dasher picks up (closes at OUT_FOR_DELIVERY);
 *   - DASHER from ASSIGNED until delivery is confirmed (read-only at DELIVERED);
 * and either stays writable for {@code chat.readOnlyAfterMinutes} after the order is
 * CANCELLED, then becomes read-only.
 *
 * Registered automatically (InboundSocketHandler) for the client→server "chat:send"
 * event. A sent message is relayed as "chat:message" to both participants (the echo
 * lets the sender reconcile its optimistic bubble via clientId); if the recipient has
 * no live socket it also goes out as a push. Rejections come back as "chat:error".
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ChatService implements InboundSocketHandler {

    static final int MAX_LENGTH = 500;

    private final ChatMessageRepository chatMessageRepository;
    private final OrderRepository orderRepository;
    private final ShopRepository shopRepository;
    private final UserRepository userRepository;
    private final ConfigService configService;
    private final SocketService socketService;
    private final PushNotificationService pushNotificationService;

    @Override
    public String event() {
        return "chat:send";
    }

    @Override
    public void handle(String senderId, String senderRole, JsonNode data) {
        String orderId = data.path("orderId").asText(null);
        String clientId = data.path("clientId").asText(null);
        ChatChannel channel = parseChannel(data.path("channel").asText(null));
        String text = data.path("text").asText("");
        try {
            send(senderId, senderRole, orderId, channel, text, clientId);
        } catch (IllegalArgumentException | IllegalStateException e) {
            Map<String, Object> error = new LinkedHashMap<>();
            error.put("clientId", clientId);
            error.put("orderId", orderId);
            error.put("channel", channel);
            error.put("error", e.getMessage());
            socketService.emitToUser(senderId, "chat:error", error);
        }
    }

    public ChatMessageDTO send(String senderId, String senderRole, String orderId,
                               ChatChannel channel, String rawText, String clientId) {
        if (orderId == null || channel == null) {
            throw new IllegalArgumentException("Missing order or channel");
        }
        String text = rawText == null ? "" : rawText.trim();
        if (text.isEmpty()) {
            throw new IllegalArgumentException("Message is empty");
        }
        if (text.length() > MAX_LENGTH) {
            throw new IllegalArgumentException("Message is too long (max " + MAX_LENGTH + " characters)");
        }

        Order order = requireOrder(orderId);
        Participants p = participants(order, channel);
        if (!p.includes(senderId)) {
            throw new IllegalArgumentException("You are not part of this conversation");
        }
        String closed = closedReason(order, channel, Instant.now());
        if (closed != null) {
            throw new IllegalStateException(closed);
        }

        ChatMessage saved = chatMessageRepository.save(ChatMessage.builder()
                .orderId(orderId)
                .channel(channel)
                .senderId(senderId)
                .senderRole(senderRole)
                .text(text)
                .createdAt(new Date())
                .build());

        ChatMessageDTO dto = ChatMessageDTO.from(saved, clientId);
        String recipientId = p.other(senderId);
        socketService.emitToUser(senderId, "chat:message", dto);
        socketService.emitToUser(recipientId, "chat:message", dto);

        // App closed or backgrounded with the socket dropped → push instead (SRS 3.5 step 4).
        if (!socketService.isUserOnline(recipientId)) {
            Map<String, Object> pushData = new LinkedHashMap<>();
            pushData.put("type", "chat");
            pushData.put("orderId", orderId);
            pushData.put("channel", channel.name());
            pushNotificationService.send(recipientId,
                    "Message from " + displayName(order, channel, senderId),
                    preview(text), pushData);
        }
        return dto;
    }

    /** Marks the other party's unread messages as read and tells the sender (read receipts). */
    public void markRead(String readerId, String orderId, ChatChannel channel) {
        if (orderId == null || channel == null) return;
        Order order = orderRepository.findById(orderId).orElse(null);
        if (order == null) return;
        Participants p = participants(order, channel);
        if (!p.includes(readerId)) return;

        List<ChatMessage> unread = chatMessageRepository
                .findByOrderIdAndChannelAndSenderIdNotAndReadAtIsNull(orderId, channel, readerId);
        if (unread.isEmpty()) return;

        Date now = new Date();
        unread.forEach(m -> m.setReadAt(now));
        chatMessageRepository.saveAll(unread);

        Map<String, Object> receipt = new LinkedHashMap<>();
        receipt.put("orderId", orderId);
        receipt.put("channel", channel);
        receipt.put("readerId", readerId);
        receipt.put("readAt", now);
        socketService.emitToUser(p.other(readerId), "chat:read", receipt);
    }

    public ChatHistoryDTO history(String userId, String orderId, ChatChannel channel) {
        Order order = requireOrder(orderId);
        Participants p = participants(order, channel);
        if (!p.includes(userId)) {
            throw new IllegalArgumentException("You are not part of this conversation");
        }
        List<ChatMessage> messages = chatMessageRepository
                .findByOrderIdAndChannelOrderByCreatedAtAsc(orderId, channel);
        String closed = closedReason(order, channel, Instant.now());
        return ChatHistoryDTO.builder()
                .orderId(orderId)
                .channel(channel)
                .counterpartName(displayName(order, channel, p.other(userId)))
                .writable(closed == null)
                .closedReason(closed)
                .reported(messages.stream().anyMatch(ChatMessage::isReported))
                .messages(messages.stream().map(m -> ChatMessageDTO.from(m, null)).toList())
                .build();
    }

    /**
     * Flags every message in the channel as reported. Reported messages fall outside
     * the partial 30-day TTL index, so they are kept for review (RA 10173, SRS 3.5).
     */
    public void report(String userId, String orderId, ChatChannel channel) {
        Order order = requireOrder(orderId);
        if (!participants(order, channel).includes(userId)) {
            throw new IllegalArgumentException("You are not part of this conversation");
        }
        List<ChatMessage> messages = chatMessageRepository
                .findByOrderIdAndChannelOrderByCreatedAtAsc(orderId, channel);
        messages.forEach(m -> m.setReported(true));
        chatMessageRepository.saveAll(messages);
        log.info("Chat reported: order={} channel={} by={}", orderId, channel, userId);
    }

    /** Null while the channel accepts messages; otherwise a short user-facing reason. */
    String closedReason(Order order, ChatChannel channel, Instant now) {
        OrderStatus status = order.getOrderStatus();
        if (status == null) return "This conversation is not available";

        if (channel == ChatChannel.SHOP) {
            switch (status) {
                case PLACED, PREPARING, READY_FOR_PICKUP, ASSIGNED:
                    return null;
                case CANCELLED:
                    return withinGrace(order, status, now) ? null : "This order was cancelled";
                default:
                    return "Shop chat closed when the dasher picked up the order";
            }
        }

        if (order.getDeliveryPersonnelId() == null) {
            return "No dasher has been assigned yet";
        }
        switch (status) {
            case ASSIGNED, OUT_FOR_DELIVERY:
                return null;
            case DELIVERED:
                // Read-only as soon as delivery is confirmed — no grace window.
                return "This order was delivered";
            case CANCELLED:
                return withinGrace(order, status, now) ? null : "This order was cancelled";
            default:
                return "No dasher has been assigned yet";
        }
    }

    private boolean withinGrace(Order order, OrderStatus terminal, Instant now) {
        Date endedAt = endedAt(order, terminal);
        if (endedAt == null) return false;
        Duration grace = Duration.ofMinutes(configService.getChatReadOnlyAfterMinutes());
        return now.isBefore(endedAt.toInstant().plus(grace));
    }

    /** When the order reached its terminal status — from history, else its last update. */
    private static Date endedAt(Order order, OrderStatus terminal) {
        List<StatusHistoryEntry> history = order.getStatusHistory();
        if (history != null) {
            for (int i = history.size() - 1; i >= 0; i--) {
                StatusHistoryEntry e = history.get(i);
                if (e.getStatus() == terminal && e.getTimestamp() != null) {
                    return e.getTimestamp();
                }
            }
        }
        return order.getUpdatedAt();
    }

    private Participants participants(Order order, ChatChannel channel) {
        String counterpart = channel == ChatChannel.SHOP
                ? shopRepository.findById(order.getShopId()).map(Shop::getOperatorId).orElse(null)
                : order.getDeliveryPersonnelId();
        return new Participants(order.getCustomerId(), counterpart);
    }

    /** Shop messages are signed by the shop's name; everyone else by their own name. */
    private String displayName(Order order, ChatChannel channel, String userId) {
        if (userId == null) {
            return channel == ChatChannel.SHOP ? "Shop" : "Dasher";
        }
        if (channel == ChatChannel.SHOP && !userId.equals(order.getCustomerId())) {
            return shopRepository.findById(order.getShopId())
                    .map(Shop::getShopName).orElse("Shop");
        }
        return userRepository.findById(userId).map(User::getFullName).orElse("CampusBrew user");
    }

    private Order requireOrder(String orderId) {
        return orderRepository.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Order not found"));
    }

    static ChatChannel parseChannel(String raw) {
        if (raw == null) return null;
        try {
            return ChatChannel.valueOf(raw.toUpperCase());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private static String preview(String text) {
        return text.length() <= 120 ? text : text.substring(0, 117) + "...";
    }

    /** The customer plus the shop operator or dasher, depending on the channel. */
    private record Participants(String customerId, String counterpartId) {
        boolean includes(String userId) {
            return userId != null && (userId.equals(customerId) || userId.equals(counterpartId));
        }

        String other(String userId) {
            return Objects.equals(userId, customerId) ? counterpartId : customerId;
        }
    }
}
