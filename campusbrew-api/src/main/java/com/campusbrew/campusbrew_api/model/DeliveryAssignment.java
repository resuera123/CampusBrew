package com.campusbrew.campusbrew_api.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.Date;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Document(collection = "deliveryAssignments")
public class DeliveryAssignment {

    @Id
    private String id;

    @Indexed
    private String orderId;

    @Indexed
    private String deliveryPersonnelId;

    private AssignmentStatus status;

    private Date assignedAt;
    private Date respondedAt;
}
