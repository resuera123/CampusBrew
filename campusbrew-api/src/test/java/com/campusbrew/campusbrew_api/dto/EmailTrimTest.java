package com.campusbrew.campusbrew_api.dto;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** A trailing space from a phone keyboard's autocomplete no longer breaks log-in or sign-up. */
class EmailTrimTest {

    private final ObjectMapper json = new ObjectMapper();

    @Test
    void requestEmailsAreTrimmedWhenRead() throws Exception {
        LoginRequest login = json.readValue(
                "{\"email\":\"admin@campusbrew.app \",\"password\":\"x\"}", LoginRequest.class);
        assertThat(login.getEmail()).isEqualTo("admin@campusbrew.app");

        RegisterRequest register = json.readValue(
                "{\"email\":\" craig@gmail.com\",\"password\":\"x\",\"fullName\":\"C\"}", RegisterRequest.class);
        assertThat(register.getEmail()).isEqualTo("craig@gmail.com");

        SchoolEmailRequest school = json.readValue("{\"schoolEmail\":\"c@cit.edu \"}", SchoolEmailRequest.class);
        assertThat(school.getSchoolEmail()).isEqualTo("c@cit.edu");
    }
}
