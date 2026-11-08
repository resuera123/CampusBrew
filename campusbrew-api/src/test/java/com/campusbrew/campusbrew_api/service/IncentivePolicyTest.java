package com.campusbrew.campusbrew_api.service;

import com.campusbrew.campusbrew_api.model.DeliveryPersonnel;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.Date;

import static com.campusbrew.campusbrew_api.service.ItemSalesService.CAMPUS_ZONE;
import static org.assertj.core.api.Assertions.assertThat;

/** The weekly dasher incentive: counts from Monday 00:00 PH time and resets each week. */
class IncentivePolicyTest {

    /** A moment in Philippine time. */
    private static Instant ph(int year, int month, int day, int hour) {
        return LocalDateTime.of(year, month, day, hour, 0).atZone(CAMPUS_ZONE).toInstant();
    }

    @Test
    void weeksStartMondayMidnightPhilippineTime() {
        // Sunday 2026-11-08 23:00 PH belongs to the week of Monday 2026-11-02.
        assertThat(IncentivePolicy.weekStart(ph(2026, 11, 8, 23)))
                .isEqualTo(Date.from(ph(2026, 11, 2, 0)));
        assertThat(IncentivePolicy.weekStart(ph(2026, 11, 9, 0)))
                .isEqualTo(Date.from(ph(2026, 11, 9, 0)));
        assertThat(IncentivePolicy.nextReset(ph(2026, 11, 8, 23)))
                .isEqualTo(Date.from(ph(2026, 11, 9, 0)));
    }

    @Test
    void theFifthDeliveryOfTheWeekUnlocksIt() {
        DeliveryPersonnel dp = DeliveryPersonnel.builder().build();
        Instant wednesday = ph(2026, 11, 4, 12);
        for (int i = 0; i < 4; i++) IncentivePolicy.recordDelivery(dp, wednesday);
        assertThat(IncentivePolicy.active(dp, 5, wednesday)).isFalse();

        assertThat(IncentivePolicy.recordDelivery(dp, wednesday)).isEqualTo(5);
        assertThat(IncentivePolicy.active(dp, 5, wednesday)).isTrue();
    }

    @Test
    void lastWeeksDeliveriesDontCountOnMonday() {
        DeliveryPersonnel dp = DeliveryPersonnel.builder().build();
        Instant saturday = ph(2026, 11, 7, 18);
        for (int i = 0; i < 6; i++) IncentivePolicy.recordDelivery(dp, saturday);
        assertThat(IncentivePolicy.active(dp, 5, saturday)).isTrue();

        Instant monday = ph(2026, 11, 9, 8);
        assertThat(IncentivePolicy.weeklyDeliveries(dp, monday)).isZero();
        assertThat(IncentivePolicy.active(dp, 5, monday)).isFalse();
        assertThat(IncentivePolicy.recordDelivery(dp, monday)).isEqualTo(1);
    }
}
