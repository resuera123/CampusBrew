package com.campusbrew.campusbrew_api.service;

import com.campusbrew.campusbrew_api.model.DeliveryPersonnel;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.Date;

import static com.campusbrew.campusbrew_api.service.ItemSalesService.CAMPUS_ZONE;

/**
 * v2.0 FR-4.3/4.4/4.5 — the dasher incentive is weekly: deliveries count from
 * Monday 00:00 Philippine time, and once this week's count reaches the threshold
 * the commission is waived for the rest of the week. The stored count belongs to
 * the week in {@code incentiveWeekStart}; an older week reads as zero, so the
 * reset needs no scheduled job (which could be missed while the server sleeps).
 */
public final class IncentivePolicy {

    private IncentivePolicy() {
    }

    /** Monday 00:00 (Philippine time) of the week containing {@code now}. */
    public static Date weekStart(Instant now) {
        LocalDate monday = now.atZone(CAMPUS_ZONE).toLocalDate()
                .with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        return Date.from(monday.atStartOfDay(CAMPUS_ZONE).toInstant());
    }

    /** When this week's count goes back to zero: next Monday 00:00 Philippine time. */
    public static Date nextReset(Instant now) {
        return Date.from(weekStart(now).toInstant().atZone(CAMPUS_ZONE).plusWeeks(1).toInstant());
    }

    /** Deliveries completed this week (0 if the stored count is from an earlier week). */
    public static int weeklyDeliveries(DeliveryPersonnel dp, Instant now) {
        if (dp == null || dp.getIncentiveWeekStart() == null) return 0;
        return dp.getIncentiveWeekStart().before(weekStart(now)) ? 0 : dp.getWeeklyDeliveries();
    }

    public static boolean active(DeliveryPersonnel dp, int threshold, Instant now) {
        return weeklyDeliveries(dp, now) >= threshold;
    }

    /** Records one more delivery this week; returns the new weekly count. */
    public static int recordDelivery(DeliveryPersonnel dp, Instant now) {
        int weekly = weeklyDeliveries(dp, now) + 1;
        dp.setWeeklyDeliveries(weekly);
        dp.setIncentiveWeekStart(weekStart(now));
        return weekly;
    }
}
