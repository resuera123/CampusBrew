package com.campusbrew.campusbrew_api.service;

/**
 * v2.0 FR-3.6 / FR-2.1 — the one rule for showing an average rating: only once the
 * ratee has at least {@code rating.minCountToShow} ratings (SRS 3.6), so a single
 * early rating can't define a shop, dasher or customer.
 */
public final class RatingDisplay {

    private RatingDisplay() {
    }

    /** The average to show, or null while there are too few ratings. */
    public static Double visible(double avg, int count, int minCountToShow) {
        return count > 0 && count >= minCountToShow ? avg : null;
    }
}
