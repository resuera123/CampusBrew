package com.campusbrew.campusbrew_api.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;

/**
 * Sends the app's code emails (sign-up, password reset, CIT-U verification).
 *
 * With brevo.apiKey set (on Render) it uses Brevo's HTTPS API, because Render's
 * free plan blocks outgoing SMTP ports. Without it (local runs) it uses Gmail
 * SMTP via spring.mail.*. Either way a failure reaches the user as a short
 * message; the details go to the log.
 */
@Slf4j
@Service
public class EmailService {

    private static final String BREVO_URL = "https://api.brevo.com/v3/smtp/email";
    static final String SEND_FAILED = "We couldn't send the email right now. Please try again in a moment.";

    private final ObjectProvider<JavaMailSender> mailSender;
    private final RestClient rest = RestClient.create();

    @Value("${brevo.apiKey:}")
    private String brevoApiKey;

    /** The verified Brevo sender; falls back to the Gmail username. */
    @Value("${mail.from:${spring.mail.username:}}")
    private String fromEmail;

    @Value("${mail.fromName:CampusBrew}")
    private String fromName;

    public EmailService(ObjectProvider<JavaMailSender> mailSender) {
        this.mailSender = mailSender;
    }

    public void sendOtpEmail(String toEmail, String otp) {
        send(toEmail, "CampusBrew - Email Verification Code",
            "Your CampusBrew verification code is: " + otp + "\n\n" +
            "This code expires in 5 minutes.\n\n" +
            "If you did not request this, please ignore this email.");
    }

    public void sendPasswordResetEmail(String toEmail, String code) {
        send(toEmail, "CampusBrew - Password Reset Code",
            "Your password reset code is: " + code + "\n\n" +
            "This code expires in 5 minutes.\n\n" +
            "If you did not request this, please ignore this email.");
    }

    public void sendVerificationEmail(String toEmail, String code) {
        send(toEmail, "CampusBrew - CIT-U Account Verification",
            "Your CIT-U verification code is: " + code + "\n\n" +
            "Enter this code in the app to verify your student status and unlock Cash on Delivery.\n\n" +
            "This code expires in 5 minutes.\n\n" +
            "If you did not request this, please ignore this email.");
    }

    private void send(String to, String subject, String text) {
        try {
            if (brevoApiKey != null && !brevoApiKey.isBlank()) {
                sendViaBrevo(to, subject, text);
            } else {
                sendViaSmtp(to, subject, text);
            }
        } catch (RuntimeException e) {
            log.error("Email to {} failed ({}): {}", to, subject, e.getMessage());
            throw new RuntimeException(SEND_FAILED, e);
        }
    }

    private void sendViaBrevo(String to, String subject, String text) {
        rest.post()
                .uri(BREVO_URL)
                .header("api-key", brevoApiKey)
                .contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.APPLICATION_JSON)
                .body(Map.of(
                        "sender", Map.of("name", fromName, "email", fromEmail),
                        "to", List.of(Map.of("email", to)),
                        "subject", subject,
                        "textContent", text))
                .retrieve()
                .toBodilessEntity();
    }

    private void sendViaSmtp(String to, String subject, String text) {
        JavaMailSender sender = mailSender.getIfAvailable();
        if (sender == null) {
            throw new IllegalStateException("No email sender configured (set brevo.apiKey or spring.mail.*)");
        }
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(fromEmail);
        message.setTo(to);
        message.setSubject(subject);
        message.setText(text);
        sender.send(message);
    }
}
