package com.campusbrew.campusbrew_api.controller;

import com.campusbrew.campusbrew_api.dto.MenuItemDTO;
import com.campusbrew.campusbrew_api.dto.ShopDTO;
import com.campusbrew.campusbrew_api.dto.UpdateShopDTO;
import com.campusbrew.campusbrew_api.service.JwtService;
import com.campusbrew.campusbrew_api.service.ShopService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/shops")
@RequiredArgsConstructor
public class ShopController {

    private final ShopService shopService;
    private final JwtService jwtService;

    @GetMapping
    public ResponseEntity<?> getAllShops(@RequestParam(value = "openOnly", defaultValue = "false") boolean openOnly) {
        try {
            List<ShopDTO> shops = openOnly ? shopService.getAllActiveShops() : shopService.getAllShops();
            return ResponseEntity.ok(shops);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/me")
    public ResponseEntity<?> getMyShop(@RequestHeader("Authorization") String authHeader) {
        try {
            String userId = jwtService.extractUserId(authHeader.replace("Bearer ", ""));
            return ResponseEntity.ok(shopService.getMyShop(userId));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getShop(@PathVariable String id) {
        try {
            return ResponseEntity.ok(shopService.getShop(id));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/{id}/menu")
    public ResponseEntity<?> getShopMenu(@PathVariable String id) {
        try {
            List<MenuItemDTO> menu = shopService.getShopMenu(id);
            return ResponseEntity.ok(menu);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/search")
    public ResponseEntity<?> searchItems(@RequestParam("q") String query) {
        try {
            return ResponseEntity.ok(shopService.searchItems(query));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/sales/total")
    public ResponseEntity<?> getMySalesTotal(@RequestHeader("Authorization") String authHeader) {
        try {
            String userId = jwtService.extractUserId(authHeader.replace("Bearer ", ""));
            return ResponseEntity.ok(shopService.getMySalesTotal(userId));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateShop(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable String id,
            @RequestBody UpdateShopDTO dto) {
        try {
            String userId = jwtService.extractUserId(authHeader.replace("Bearer ", ""));
            return ResponseEntity.ok(shopService.updateShop(userId, id, dto));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        }
    }
}
