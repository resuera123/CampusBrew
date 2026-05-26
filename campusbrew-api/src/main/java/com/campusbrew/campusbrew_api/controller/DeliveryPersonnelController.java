package com.campusbrew.campusbrew_api.controller;

import com.campusbrew.campusbrew_api.dto.AvailabilityToggleDTO;
import com.campusbrew.campusbrew_api.dto.UpdateLocationDTO;
import com.campusbrew.campusbrew_api.dto.UpdateScheduleDTO;
import com.campusbrew.campusbrew_api.service.DeliveryPersonnelService;
import com.campusbrew.campusbrew_api.service.JwtService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/delivery")
@RequiredArgsConstructor
public class DeliveryPersonnelController {

    private final DeliveryPersonnelService deliveryPersonnelService;
    private final JwtService jwtService;

    @GetMapping("/me")
    public ResponseEntity<?> getMyProfile(@RequestHeader("Authorization") String authHeader) {
        try {
            String userId = userIdFrom(authHeader);
            return ResponseEntity.ok(deliveryPersonnelService.getMyProfile(userId));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/availability")
    public ResponseEntity<?> setAvailability(
            @RequestHeader("Authorization") String authHeader,
            @RequestBody AvailabilityToggleDTO dto) {
        try {
            String userId = userIdFrom(authHeader);
            return ResponseEntity.ok(deliveryPersonnelService.setAvailability(userId, dto.isActive()));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/schedule")
    public ResponseEntity<?> updateSchedule(
            @RequestHeader("Authorization") String authHeader,
            @RequestBody UpdateScheduleDTO dto) {
        try {
            String userId = userIdFrom(authHeader);
            return ResponseEntity.ok(deliveryPersonnelService.updateSchedule(userId, dto.getSchedule()));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/location")
    public ResponseEntity<?> updateLocation(
            @RequestHeader("Authorization") String authHeader,
            @RequestBody UpdateLocationDTO dto) {
        try {
            String userId = userIdFrom(authHeader);
            return ResponseEntity.ok(
                    deliveryPersonnelService.updateLocation(userId, dto.getLongitude(), dto.getLatitude()));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        }
    }

    private String userIdFrom(String authHeader) {
        return jwtService.extractUserId(authHeader.replace("Bearer ", ""));
    }
}
