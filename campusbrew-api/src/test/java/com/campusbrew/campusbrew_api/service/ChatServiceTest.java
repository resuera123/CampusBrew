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
import com.campusbrew.campusbrew_api.repository.ReportRepository;
import com.campusbrew.campusbrew_api.repository.ChatMessageRepository;
import com.campusbrew.campusbrew_api.repository.OrderRepository;
import com.campusbrew.campusbrew_api.repository.ShopRepository;
import com.campusbrew.campusbrew_api.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** v2.0 FR-3.5 / NFR-S9 — participants only, channel windows, relay + push fallback, receipts. */
class ChatServiceTest {

    private ChatMessageRepository chatRepo;
    private OrderRepository orderRepo;
    private SocketService socket;
    private PushNotificationService push;
    private ChatService service;
    private final ObjectMapper mapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        chatRepo = mock(ChatMessageRepository.class);
        orderRepo = mock(OrderRepository.class);
        ShopRepository shopRepo = mock(ShopRepository.class);
        UserRepository userRepo = mock(UserRepository.class);
        ConfigService config = mock(ConfigService.class);
        socket = mock(SocketService.class);
        push = mock(PushNotificationService.class);

        when(config.getChatReadOnlyAfterMinutes()).thenReturn(30);
        when(shopRepo.findById("s1")).thenReturn(Optional.of(
                Shop.builder().id("s1").operatorId("op1").shopName("Brew Central").build()));
        when(userRepo.findById("c1")).thenReturn(Optional.of(User.builder().id("c1").fullName("Juan").build()));
        when(userRepo.findById("d1")).thenReturn(Optional.of(User.builder().id("d1").fullName("Mark").build()));
        when(chatRepo.save(any(ChatMessage.class))).thenAnswer(inv -> {
            ChatMessage m = inv.getArgument(0);
            m.setId("m1");
            return m;
        });
        when(socket.isUserOnline(anyString())).thenReturn(true);

        service = new ChatService(chatRepo, orderRepo, shopRepo, userRepo, config, socket, push,
                mock(ReportRepository.class));
    }

    private Order order(OrderStatus status, String dp, Instant statusAt) {
        Order o = Order.builder().id("o1").customerId("c1").shopId("s1").deliveryPersonnelId(dp)
                .orderStatus(status)
                .statusHistory(List.of(StatusHistoryEntry.builder()
                        .status(status).timestamp(Date.from(statusAt)).build()))
                .build();
        when(orderRepo.findById("o1")).thenReturn(Optional.of(o));
        return o;
    }

    @Test
    void customerMessageToShopIsRelayedToBothParticipants() {
        order(OrderStatus.PREPARING, null, Instant.now());

        ChatMessageDTO dto = service.send("c1", "CUSTOMER", "o1", ChatChannel.SHOP, "  less ice please ", "tmp-1");

        assertThat(dto.getText()).isEqualTo("less ice please");
        assertThat(dto.getClientId()).isEqualTo("tmp-1");
        verify(socket).emitToUser("c1", "chat:message", dto);
        verify(socket).emitToUser("op1", "chat:message", dto);
        verifyNoInteractions(push);
    }

    @Test
    void offlineRecipientGetsAPush() {
        order(OrderStatus.OUT_FOR_DELIVERY, "d1", Instant.now());
        when(socket.isUserOnline("c1")).thenReturn(false);

        service.send("d1", "DELIVERY_PERSONNEL", "o1", ChatChannel.DASHER, "I'm at the lobby", null);

        ArgumentCaptor<Map> data = ArgumentCaptor.forClass(Map.class);
        verify(push).send(eq("c1"), eq("Message from Mark"), eq("I'm at the lobby"), data.capture());
        assertThat(data.getValue().get("type")).isEqualTo("chat");
        assertThat(data.getValue().get("channel")).isEqualTo("DASHER");
    }

    @Test
    void nonParticipantCannotSendOrRead() {
        order(OrderStatus.OUT_FOR_DELIVERY, "d1", Instant.now());

        assertThatThrownBy(() -> service.send("op1", "SHOP_OPERATOR", "o1", ChatChannel.DASHER, "hi", null))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.history("intruder", "o1", ChatChannel.SHOP))
                .isInstanceOf(IllegalArgumentException.class);
        verify(chatRepo, never()).save(any());
    }

    @Test
    void shopChannelClosesAtPickup() {
        order(OrderStatus.OUT_FOR_DELIVERY, "d1", Instant.now());

        assertThatThrownBy(() -> service.send("c1", "CUSTOMER", "o1", ChatChannel.SHOP, "hi", null))
                .isInstanceOf(IllegalStateException.class);
        assertThat(service.history("c1", "o1", ChatChannel.SHOP).isWritable()).isFalse();
    }

    @Test
    void dasherChannelNeedsAnAssignedDasher() {
        order(OrderStatus.READY_FOR_PICKUP, null, Instant.now());

        ChatHistoryDTO h = service.history("c1", "o1", ChatChannel.DASHER);
        assertThat(h.isWritable()).isFalse();
        assertThat(h.getClosedReason()).contains("No dasher");
        assertThatThrownBy(() -> service.send("c1", "CUSTOMER", "o1", ChatChannel.DASHER, "hi", null))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void dasherChannelIsReadOnlyAsSoonAsDeliveryIsConfirmed() {
        order(OrderStatus.DELIVERED, "d1", Instant.now());
        ChatHistoryDTO h = service.history("c1", "o1", ChatChannel.DASHER);
        assertThat(h.isWritable()).isFalse();
        assertThat(h.getClosedReason()).contains("delivered");
        assertThatThrownBy(() -> service.send("c1", "CUSTOMER", "o1", ChatChannel.DASHER, "thanks", null))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void cancelledOrderKeepsTheGraceWindow() {
        order(OrderStatus.CANCELLED, null, Instant.now().minus(10, ChronoUnit.MINUTES));
        assertThat(service.history("c1", "o1", ChatChannel.SHOP).isWritable()).isTrue();

        order(OrderStatus.CANCELLED, null, Instant.now().minus(31, ChronoUnit.MINUTES));
        assertThat(service.history("c1", "o1", ChatChannel.SHOP).isWritable()).isFalse();
    }

    @Test
    void socketRejectionComesBackAsChatError() {
        order(OrderStatus.DELIVERED, "d1", Instant.now().minus(2, ChronoUnit.HOURS));

        service.handle("c1", "CUSTOMER", mapper.valueToTree(
                Map.of("orderId", "o1", "channel", "dasher", "text", "thanks", "clientId", "tmp-9")));

        ArgumentCaptor<Map> err = ArgumentCaptor.forClass(Map.class);
        verify(socket).emitToUser(eq("c1"), eq("chat:error"), err.capture());
        assertThat(err.getValue().get("clientId")).isEqualTo("tmp-9");
        verify(chatRepo, never()).save(any());
    }

    @Test
    void emptyOrOverlongMessagesAreRejected() {
        order(OrderStatus.PLACED, null, Instant.now());

        assertThatThrownBy(() -> service.send("c1", "CUSTOMER", "o1", ChatChannel.SHOP, "   ", null))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.send("c1", "CUSTOMER", "o1", ChatChannel.SHOP,
                "x".repeat(ChatService.MAX_LENGTH + 1), null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void markReadStampsOtherPartysMessagesAndNotifiesThem() {
        order(OrderStatus.OUT_FOR_DELIVERY, "d1", Instant.now());
        ChatMessage fromDasher = ChatMessage.builder().id("m1").senderId("d1").build();
        when(chatRepo.findByOrderIdAndChannelAndSenderIdNotAndReadAtIsNull("o1", ChatChannel.DASHER, "c1"))
                .thenReturn(List.of(fromDasher));

        service.markRead("c1", "o1", ChatChannel.DASHER);

        assertThat(fromDasher.getReadAt()).isNotNull();
        verify(chatRepo).saveAll(List.of(fromDasher));
        verify(socket).emitToUser(eq("d1"), eq("chat:read"), any());
    }

    @Test
    void reportFlagsTheWholeConversation() {
        order(OrderStatus.DELIVERED, "d1", Instant.now());
        ChatMessage a = ChatMessage.builder().id("a").build();
        ChatMessage b = ChatMessage.builder().id("b").build();
        when(chatRepo.findByOrderIdAndChannelOrderByCreatedAtAsc("o1", ChatChannel.DASHER)).thenReturn(List.of(a, b));

        service.report("d1", "o1", ChatChannel.DASHER);

        assertThat(a.isReported()).isTrue();
        assertThat(b.isReported()).isTrue();
    }

    @Test
    void handlesTheChatSendEvent() {
        assertThat(service.event()).isEqualTo("chat:send");
    }
}
