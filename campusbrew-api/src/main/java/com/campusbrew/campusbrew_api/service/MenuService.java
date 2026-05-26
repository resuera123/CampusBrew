package com.campusbrew.campusbrew_api.service;

import com.campusbrew.campusbrew_api.dto.CreateMenuItemDTO;
import com.campusbrew.campusbrew_api.dto.MenuItemDTO;
import com.campusbrew.campusbrew_api.dto.UpdateMenuItemDTO;
import com.campusbrew.campusbrew_api.model.MenuItem;
import com.campusbrew.campusbrew_api.model.Shop;
import com.campusbrew.campusbrew_api.model.User;
import com.campusbrew.campusbrew_api.model.UserRole;
import com.campusbrew.campusbrew_api.repository.MenuItemRepository;
import com.campusbrew.campusbrew_api.repository.ShopRepository;
import com.campusbrew.campusbrew_api.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class MenuService {

    private final MenuItemRepository menuItemRepository;
    private final ShopRepository shopRepository;
    private final UserRepository userRepository;

    public MenuItemDTO createItem(String operatorUserId, CreateMenuItemDTO dto) {
        Shop shop = requireOwnedShop(operatorUserId, dto.getShopId());

        MenuItem item = MenuItem.builder()
                .shopId(shop.getId())
                .name(dto.getName())
                .price(dto.getPrice())
                .description(dto.getDescription())
                .category(dto.getCategory())
                .image(dto.getImage())
                .isAvailable(dto.isAvailable())
                .stockStatus(dto.getStockStatus())
                .customizationOptions(dto.getCustomizationOptions())
                .build();

        return MenuItemDTO.fromMenuItem(menuItemRepository.save(item));
    }

    public MenuItemDTO updateItem(String operatorUserId, String itemId, UpdateMenuItemDTO dto) {
        MenuItem item = menuItemRepository.findById(itemId)
                .orElseThrow(() -> new RuntimeException("Menu item not found"));
        requireOwnedShop(operatorUserId, item.getShopId());

        if (dto.getName() != null) item.setName(dto.getName());
        if (dto.getPrice() != null) item.setPrice(dto.getPrice());
        if (dto.getDescription() != null) item.setDescription(dto.getDescription());
        if (dto.getCategory() != null) item.setCategory(dto.getCategory());
        if (dto.getImage() != null) item.setImage(dto.getImage());
        if (dto.getIsAvailable() != null) item.setAvailable(dto.getIsAvailable());
        if (dto.getStockStatus() != null) item.setStockStatus(dto.getStockStatus());
        if (dto.getCustomizationOptions() != null) item.setCustomizationOptions(dto.getCustomizationOptions());

        return MenuItemDTO.fromMenuItem(menuItemRepository.save(item));
    }

    public MenuItemDTO toggleAvailability(String operatorUserId, String itemId, boolean isAvailable) {
        MenuItem item = menuItemRepository.findById(itemId)
                .orElseThrow(() -> new RuntimeException("Menu item not found"));
        requireOwnedShop(operatorUserId, item.getShopId());
        item.setAvailable(isAvailable);
        return MenuItemDTO.fromMenuItem(menuItemRepository.save(item));
    }

    public void deleteItem(String operatorUserId, String itemId) {
        MenuItem item = menuItemRepository.findById(itemId)
                .orElseThrow(() -> new RuntimeException("Menu item not found"));
        requireOwnedShop(operatorUserId, item.getShopId());
        menuItemRepository.deleteById(itemId);
    }

    private Shop requireOwnedShop(String operatorUserId, String shopId) {
        User user = userRepository.findById(operatorUserId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        if (user.getRole() != UserRole.SHOP_OPERATOR) {
            throw new RuntimeException("Only shop operators can manage menu items");
        }
        Shop shop = shopRepository.findById(shopId)
                .orElseThrow(() -> new RuntimeException("Shop not found"));
        if (!operatorUserId.equals(shop.getOperatorId())) {
            throw new RuntimeException("Shop does not belong to this operator");
        }
        return shop;
    }
}
