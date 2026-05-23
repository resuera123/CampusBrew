package com.campusbrew.campusbrew_api.service;

import lombok.RequiredArgsConstructor;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class EmailService {

    private final JavaMailSender mailSender;

    public void sendOtpEmail(String toEmail, String otp) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setTo(toEmail);
        message.setSubject("CampusBrew - Email Verification Code");
        message.setText(
            "Your CampusBrew verification code is: " + otp + "\n\n" +
            "This code expires in 5 minutes.\n\n" +
            "If you did not request this, please ignore this email."
        );
        mailSender.send(message);
    }

    public void sendPasswordResetEmail(String toEmail, String code) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setTo(toEmail);
        message.setSubject("CampusBrew - Password Reset Code");
        message.setText(
            "Your password reset code is: " + code + "\n\n" +
            "This code expires in 5 minutes.\n\n" +
            "If you did not request this, please ignore this email."
        );
        mailSender.send(message);
    }
}