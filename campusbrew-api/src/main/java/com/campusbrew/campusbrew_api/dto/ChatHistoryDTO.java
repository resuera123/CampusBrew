package com.campusbrew.campusbrew_api.dto;

import com.campusbrew.campusbrew_api.model.ChatChannel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/** v2.0 FR-3.5 — one order channel's history plus whether the caller may still write to it. */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ChatHistoryDTO {
    private String orderId;
    private ChatChannel channel;
    /** Display name of the other party (shop name, dasher or customer name). */
    private String counterpartName;
    private boolean writable;
    /** Why the channel is read-only, for the banner; null while writable. */
    private String closedReason;
    private boolean reported;
    private List<ChatMessageDTO> messages;
}
