package com.campusbrew.campusbrew_api.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.Date;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Document(collection = "orders")
public class Order {

    @Id
    private String id;

    @Indexed
    private String customerId;

    @Indexed
    private String shopId;

    private String deliveryPersonnelId;

    private List<OrderItem> items;

    private String deliveryLocation;
    /** Free-text notes from the customer to the rider (gate code, building, etc.). */
    private String dasherInstructions;

    private PaymentMethod paymentMethod;
    private PaymentStatus paymentStatus;
    private OrderStatus orderStatus;

    private double beverageSubtotal;
    private double deliveryFee;
    private double platformCommission;
    private double totalAmount;

    // v2.0 FR-2.2/4.7 — tip is added to the customer total and paid 100% to the dasher.
    private double tip;

    // v2.0 FR-3.4 — free-text drop-off note shown to the dasher on the offer/tracking.
    private String dropoffNote;

    // v2.0 FR-3.3 — when the shop confirmed it received payment from the dasher.
    private Date shopPaymentConfirmedAt;

    // v2.0 FR-4.2 — COD two-sided settlement. Both set → match=PAID_COD, mismatch=FLAGGED.
    private Double cashCollectedAmount;
    private Double customerConfirmedAmount;

    private List<StatusHistoryEntry> statusHistory;

    /** When the shop marked the order Ready for Pickup. Drives the 10-min auto-cancel. */
    private Date readyAt;

    /**
     * v2.0 FR-3.2 — when the unclaimed offer was re-broadcast to all active dashers
     * (ignoring pickup range). Null until the 60s window lapses; set once so the
     * re-broadcast fires exactly once.
     */
    private Date rebroadcastAt;

    private Date createdAt;
    private Date updatedAt;

    /**
     * When the order last entered {@code status}, from statusHistory, falling back to
     * updatedAt. Drives the post-delivery windows (chat, rating, tip).
     */
    public Date reachedAt(OrderStatus status) {
        if (statusHistory != null) {
            for (int i = statusHistory.size() - 1; i >= 0; i--) {
                StatusHistoryEntry e = statusHistory.get(i);
                if (e.getStatus() == status && e.getTimestamp() != null) {
                    return e.getTimestamp();
                }
            }
        }
        return updatedAt;
    }
}
