package com.campusbrew.campusbrew_api.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.Date;

/**
 * A message to CampusBrew support from the login screen: a suspension appeal, a
 * question or anything else. Sent without logging in, so it is matched to an
 * account by email only.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Document(collection = "supportTickets")
public class SupportTicket implements Referenced {

    public static final String APPEAL = "APPEAL";
    public static final String QUESTION = "QUESTION";
    public static final String OTHER = "OTHER";

    @Id
    private String id;

    private String ref;

    @Indexed
    private String email;
    private String name;
    private String userId;      // the account with that email, if there is one

    private String topic;       // APPEAL | QUESTION | OTHER
    private String message;

    private ReportStatus status;
    private String resolvedBy;
    private Date resolvedAt;

    private Date createdAt;

    @Override
    public String refPrefix() {
        return "SUP";
    }
}
