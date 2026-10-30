package com.campusbrew.campusbrew_api.model;

public enum UserRole {
    CUSTOMER,
    DELIVERY_PERSONNEL,
    SHOP_OPERATOR,
    // Reviews dasher applications and reports; seeded by AdminSeeder, never self-registered.
    ADMIN
}