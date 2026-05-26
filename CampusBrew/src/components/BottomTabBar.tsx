import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';

interface BottomTabBarProps {
  state: any;
  descriptors: any;
  navigation: any;
}

const TAB_CONFIG: Record<string, { icon: string; iconFocused: string; label: string }> = {
  CustomerHome: { icon: 'home-outline', iconFocused: 'home', label: 'Home' },
  Orders: { icon: 'bag-outline', iconFocused: 'bag', label: 'Orders' },
  Profile: { icon: 'person-outline', iconFocused: 'person', label: 'Profile' },
  // Delivery role tabs
  DeliveryDashboard: { icon: 'home-outline', iconFocused: 'home', label: 'Home' },
  DeliveryOrders: { icon: 'bicycle-outline', iconFocused: 'bicycle', label: 'Delivery' },
  DeliveryProfile: { icon: 'person-outline', iconFocused: 'person', label: 'Profile' },
  // Shop role tabs
  ShopDashboard: { icon: 'home-outline', iconFocused: 'home', label: 'Home' },
  ShopOrders: { icon: 'bag-outline', iconFocused: 'bag', label: 'Orders' },
  ShopProfile: { icon: 'person-outline', iconFocused: 'person', label: 'Profile' },
};

export default function BottomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  return (
    <View style={styles.container}>
      {state.routes.map((route: any, index: number) => {
        const { options } = descriptors[route.key];
        const isFocused = state.index === index;
        const config = TAB_CONFIG[route.name] || {
          icon: 'ellipse-outline',
          iconFocused: 'ellipse',
          label: route.name,
        };

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <TouchableOpacity
            key={route.key}
            onPress={onPress}
            style={styles.tab}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel}
          >
            <Ionicons
              name={(isFocused ? config.iconFocused : config.icon) as any}
              size={24}
              color={isFocused ? COLORS.primary : COLORS.textSecondary}
            />
            <Text
              style={[
                styles.label,
                { color: isFocused ? COLORS.primary : COLORS.textSecondary },
                isFocused && styles.labelActive,
              ]}
            >
              {config.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 64,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 32,
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  label: {
    fontSize: 12,
  },
  labelActive: {
    fontWeight: '600',
  },
});