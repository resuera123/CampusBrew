package com.campusbrew.campusbrew_api.service;

import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.Locale;
import java.util.Set;

/**
 * v2.0 FR-3.6 — flags reviews containing offensive words (English, Tagalog and
 * Cebuano) so they are hidden until an administrator checks them. Matches whole
 * words only, so ordinary words that merely contain a blocked one are not flagged.
 */
@Component
public class ModerationFilter {

    private static final Set<String> BLOCKED = Set.of(
            "fuck", "fucking", "fucker", "shit", "bitch", "asshole", "bastard", "cunt", "motherfucker",
            "putangina", "putang", "tangina", "gago", "gaga", "tanga", "bobo", "ulol", "tarantado",
            "punyeta", "pakyu", "kupal", "yawa", "buang", "pisti", "piste");

    /** True if the text contains a blocked word and should be hidden pending review. */
    public boolean isOffensive(String text) {
        if (text == null || text.isBlank()) return false;
        String normalized = text.toLowerCase(Locale.ROOT).replaceAll("[^\\p{L}]+", " ").trim();
        if (Arrays.stream(normalized.split(" ")).anyMatch(BLOCKED::contains)) return true;
        // Catch the common split spelling "putang ina" as well.
        return normalized.replace(" ", "").contains("putangina");
    }
}
