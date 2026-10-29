package com.campusbrew.campusbrew_api.repository;

import com.campusbrew.campusbrew_api.model.ChatChannel;
import com.campusbrew.campusbrew_api.model.ChatMessage;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ChatMessageRepository extends MongoRepository<ChatMessage, String> {

    List<ChatMessage> findByOrderIdAndChannelOrderByCreatedAtAsc(String orderId, ChatChannel channel);

    /** Unread messages in a channel that someone other than {@code readerId} sent. */
    List<ChatMessage> findByOrderIdAndChannelAndSenderIdNotAndReadAtIsNull(
            String orderId, ChatChannel channel, String readerId);
}
