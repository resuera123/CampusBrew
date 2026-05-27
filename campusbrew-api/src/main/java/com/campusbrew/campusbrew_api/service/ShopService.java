package com.campusbrew.campusbrew_api.service;

import com.campusbrew.campusbrew_api.dto.MenuItemDTO;
import com.campusbrew.campusbrew_api.dto.SalesTotalDTO;
import com.campusbrew.campusbrew_api.dto.ShopDTO;
import com.campusbrew.campusbrew_api.dto.UpdateShopDTO;
import com.campusbrew.campusbrew_api.model.MenuItem;
import com.campusbrew.campusbrew_api.model.Order;
import com.campusbrew.campusbrew_api.model.OrderStatus;
import com.campusbrew.campusbrew_api.model.Shop;
import com.campusbrew.campusbrew_api.model.User;
import com.campusbrew.campusbrew_api.model.UserRole;
import com.campusbrew.campusbrew_api.repository.MenuItemRepository;
import com.campusbrew.campusbrew_api.repository.OrderRepository;
import com.campusbrew.campusbrew_api.repository.ShopRepository;
import com.campusbrew.campusbrew_api.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ShopService {

    private final ShopRepository shopRepository;
    private final MenuItemRepository menuItemRepository;
    private final UserRepository userRepository;
    private final OrderRepository orderRepository;

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

    public ShopDTO getMyShop(String operatorUserId) {
        User user = userRepository.findById(operatorUserId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        if (user.getRole() != UserRole.SHOP_OPERATOR) {
            throw new RuntimeException("Only shop operators have a managed shop");
        }
        List<Shop> shops = shopRepository.findByOperatorId(operatorUserId);
        if (!shops.isEmpty()) {
            return ShopDTO.fromShop(shops.get(0));
        }
        // Backfill: older accounts that registered before auto-provisioning was added
        // get a blank shop created on first access so they can start managing it.
        Shop fresh = Shop.builder()
                .operatorId(operatorUserId)
                .shopName(user.getFullName() != null ? user.getFullName() + "'s Shop" : "Untitled Shop")
                .description("")
                .location("")
                .isOpen(false)
                .rating(0.0)
                .build();
        return ShopDTO.fromShop(shopRepository.save(fresh));
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

    /**
     * Lifetime sales total for the operator's shop. Sums beverageSubtotal (not
     * totalAmount — delivery fee + platform commission are not the shop's revenue)
     * across every DELIVERED order. Verified by operator role + ownership.
     */
    public SalesTotalDTO getMySalesTotal(String operatorUserId) {
        Shop shop = requireOwnedShopByUser(operatorUserId);
        List<Order> delivered = orderRepository.findByShopIdOrderByCreatedAtDesc(shop.getId()).stream()
                .filter(o -> o.getOrderStatus() == OrderStatus.DELIVERED)
                .toList();
        double total = delivered.stream().mapToDouble(Order::getBeverageSubtotal).sum();
        return SalesTotalDTO.builder()
                .totalSales(round(total))
                .totalOrders(delivered.size())
                .build();
    }

    private Shop requireOwnedShopByUser(String operatorUserId) {
        User user = userRepository.findById(operatorUserId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        if (user.getRole() != UserRole.SHOP_OPERATOR) {
            throw new RuntimeException("Only shop operators can read sales totals");
        }
        return shopRepository.findByOperatorId(operatorUserId).stream().findFirst()
                .orElseThrow(() -> new RuntimeException("No shop is registered to this operator"));
    }

    private double round(double v) {
        return Math.round(v * 100.0) / 100.0;
    }

    public ShopDTO updateShop(String operatorUserId, String shopId, UpdateShopDTO dto) {
        User user = userRepository.findById(operatorUserId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        if (user.getRole() != UserRole.SHOP_OPERATOR) {
            throw new RuntimeException("Only shop operators can update shops");
        }
        Shop shop = shopRepository.findById(shopId)
                .orElseThrow(() -> new RuntimeException("Shop not found"));
        if (!operatorUserId.equals(shop.getOperatorId())) {
            throw new RuntimeException("Shop does not belong to this operator");
        }

        if (dto.getShopName() != null) shop.setShopName(dto.getShopName());
        if (dto.getDescription() != null) shop.setDescription(dto.getDescription());
        if (dto.getOperatingHours() != null) shop.setOperatingHours(dto.getOperatingHours());
        if (dto.getLocation() != null) shop.setLocation(dto.getLocation());
        if (dto.getShopImage() != null) shop.setShopImage(dto.getShopImage());
        if (dto.getEstimatedPrepTime() != null) shop.setEstimatedPrepTime(dto.getEstimatedPrepTime());
        if (dto.getIsOpen() != null) shop.setOpen(dto.getIsOpen());

        return ShopDTO.fromShop(shopRepository.save(shop));
    }
}
