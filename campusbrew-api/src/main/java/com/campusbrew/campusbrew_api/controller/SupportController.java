package com.campusbrew.campusbrew_api.controller;

import com.campusbrew.campusbrew_api.service.SupportService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/** Contact Support from the login screen. Public: suspended and logged-out users need it. */
@RestController
@RequestMapping("/api/support")
@RequiredArgsConstructor
public class SupportController {

    private final SupportService supportService;

    /** Body {email, name?, topic: APPEAL | QUESTION | OTHER, message}; answers with the ticket's reference. */
    @PostMapping
    public ResponseEntity<?> submit(@RequestBody Map<String, String> body) {
        try {
            var ticket = supportService.submit(
                    body.get("email"), body.get("name"), body.get("topic"), body.get("message"));
            return ResponseEntity.ok(Map.of("ref", ticket.getRef() == null ? "" : ticket.getRef()));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        }
    }
}
