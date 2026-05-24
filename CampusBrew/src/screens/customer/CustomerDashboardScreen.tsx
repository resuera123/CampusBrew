import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { COLORS, SIZES } from '../../constants/theme';

const QUICK_ACCESS = [
  {
    icon: 'cafe-outline' as const,
    title: 'Browse Beverages',
    subtitle: 'Explore campus shops',
    route: 'CustomerHome',
  },
  {
    icon: 'bag-outline' as const,
    title: 'My Orders',
    subtitle: 'View order history',
    route: 'OrderHistory',
  },
  {
    icon: 'location-outline' as const,
    title: 'Track Order',
    subtitle: 'See delivery status',
    route: 'OrderTracking',
  },
  {
    icon: 'person-outline' as const,
    title: 'My Profile',
    subtitle: 'Manage account',
    route: 'Profile',
  },
];

export default function CustomerDashboardScreen({ navigation }: any) {
  const { user } = useAuth();

  const getRoleBadgeLabel = () => {
    switch (user?.role) {
      case 'CUSTOMER':
        return 'Student';
      case 'DELIVERY_PERSONNEL':
        return 'Delivery';
      case 'SHOP_OPERATOR':
        return 'Shop Operator';
      default:
        return 'Student';
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      {/* Top Bar — matches wireframe: title centered, menu left, bell right */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.topBarIcon}>
          <Ionicons name="menu" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Dashboard</Text>
        <TouchableOpacity style={styles.topBarIcon}>
          <Ionicons name="notifications-outline" size={24} color={COLORS.text} />
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Welcome Section */}
        <View style={styles.welcomeSection}>
          <Text style={styles.welcomeText}>
            Welcome back, {user?.fullName || 'User'}!
          </Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{getRoleBadgeLabel()}</Text>
          </View>
        </View>

        {/* Quick Access */}
        <View style={styles.quickAccessSection}>
          <Text style={styles.sectionTitle}>Quick Access</Text>

          <View style={styles.quickAccessList}>
            {QUICK_ACCESS.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={styles.quickAccessCard}
                onPress={() => {
                  // Navigate to the respective screen
                  // Some screens may not exist yet — safe to add later
                  try {
                    navigation.navigate(item.route);
                  } catch {
                    // Screen not yet implemented
                  }
                }}
                activeOpacity={0.7}
              >
                <View style={styles.quickAccessIcon}>
                  <Ionicons name={item.icon} size={24} color={COLORS.primary} />
                </View>

                <View style={styles.quickAccessTextContainer}>
                  <Text style={styles.quickAccessTitle}>{item.title}</Text>
                  <Text style={styles.quickAccessSubtitle}>{item.subtitle}</Text>
                </View>

                <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.backgroundSecondary,
  },

  // Top Bar — white bg, border bottom, per wireframe
  topBar: {
    height: 56,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  topBarIcon: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBarTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },

  // Content
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 24,
  },

  // Welcome
  welcomeSection: {
    marginBottom: 32,
  },
  welcomeText: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.white,
  },

  // Quick Access
  quickAccessSection: {},
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 16,
  },
  quickAccessList: {
    gap: 12,
  },
  quickAccessCard: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    // Subtle shadow per wireframe
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  quickAccessIcon: {
    width: 48,
    height: 48,
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickAccessTextContainer: {
    flex: 1,
  },
  quickAccessTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  quickAccessSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
});
