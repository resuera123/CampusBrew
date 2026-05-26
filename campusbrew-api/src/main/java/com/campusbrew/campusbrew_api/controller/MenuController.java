package com.campusbrew.campusbrew_api.controller;

import com.campusbrew.campusbrew_api.dto.AvailabilityDTO;
import com.campusbrew.campusbrew_api.dto.CreateMenuItemDTO;
import com.campusbrew.campusbrew_api.dto.UpdateMenuItemDTO;
import com.campusbrew.campusbrew_api.service.JwtService;
import com.campusbrew.campusbrew_api.service.MenuService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/menus")
@RequiredArgsConstructor
public class MenuController {

    private final MenuService menuService;
    private final JwtService jwtService;

    @PostMapping
    public ResponseEntity<?> createItem(
            @RequestHeader("Authorization") String authHeader,
            @Valid @RequestBody CreateMenuItemDTO dto) {
        try {
            String userId = userIdFrom(authHeader);
            return ResponseEntity.status(HttpStatus.CREATED).body(menuService.createItem(userId, dto));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateItem(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable String id,
            @RequestBody UpdateMenuItemDTO dto) {
        try {
            String userId = userIdFrom(authHeader);
            return ResponseEntity.ok(menuService.updateItem(userId, id, dto));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        }
    }

    @PatchMapping("/{id}/availability")
    public ResponseEntity<?> toggleAvailability(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable String id,
            @RequestBody AvailabilityDTO dto) {
        try {
            String userId = userIdFrom(authHeader);
            return ResponseEntity.ok(menuService.toggleAvailability(userId, id, dto.isAvailable()));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteItem(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable String id) {
        try {
            String userId = userIdFrom(authHeader);
            menuService.deleteItem(userId, id);
            return ResponseEntity.noContent().build();
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        }
    }

    private String userIdFrom(String authHeader) {
        String token = authHeader.replace("Bearer ", "");
        return jwtService.extractUserId(token);
    }
}
