package com.campusbrew.campusbrew_api.service;

import com.campusbrew.campusbrew_api.dto.MenuItemDTO;
import com.campusbrew.campusbrew_api.dto.ShopDTO;
import com.campusbrew.campusbrew_api.model.MenuItem;
import com.campusbrew.campusbrew_api.model.Shop;
import com.campusbrew.campusbrew_api.repository.MenuItemRepository;
import com.campusbrew.campusbrew_api.repository.ShopRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ShopService {

    private final ShopRepository shopRepository;
    private final MenuItemRepository menuItemRepository;

    public List<ShopDTO> getAllActiveShops() {
        return shopRepository.findByIsOpenTrue().stream()
                .map(ShopDTO::fromShop)
                .collect(Collectors.toList());
    }

    public List<ShopDTO> getAllShops() {
        return shopRepository.findAll().stream()
                .map(ShopDTO::fromShop)
                .collect(Collectors.toList());
    }

    public ShopDTO getShop(String shopId) {
        Shop shop = shopRepository.findById(shopId)
                .orElseThrow(() -> new RuntimeException("Shop not found"));
        return ShopDTO.fromShop(shop);
    }

    public List<MenuItemDTO> getShopMenu(String shopId) {
        if (!shopRepository.existsById(shopId)) {
            throw new RuntimeException("Shop not found");
        }
        return menuItemRepository.findByShopIdOrderByCategory(shopId).stream()
                .map(MenuItemDTO::fromMenuItem)
                .collect(Collectors.toList());
    }

    public List<MenuItemDTO> searchItems(String query) {
        if (query == null || query.isBlank()) {
            return List.of();
        }
        return menuItemRepository.findByNameContainingIgnoreCase(query).stream()
                .map(MenuItemDTO::fromMenuItem)
                .collect(Collectors.toList());
    }

    public MenuItem requireMenuItem(String menuItemId) {
        return menuItemRepository.findById(menuItemId)
                .orElseThrow(() -> new RuntimeException("Menu item not found: " + menuItemId));
    }
}
