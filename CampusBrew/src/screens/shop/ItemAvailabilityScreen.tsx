import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SIZES } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { ShopService, MenuItem } from '../../services/ShopService';

export default function ItemAvailabilityScreen({ route, navigation }: any) {
  const { token } = useAuth();
  const [shopId, setShopId] = useState<string | undefined>(route?.params?.shopId);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setError(null);
      let resolvedShopId = shopId;
      if (!resolvedShopId) {
        const myShop = await ShopService.getMyShop(token);
        resolvedShopId = myShop.id;
        setShopId(resolvedShopId);
      }
      const menu = await ShopService.getMenu(resolvedShopId);
      setItems(menu);
    } catch (e: any) {
      setError(e.message || 'Could not load menu');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, shopId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const toggle = async (item: MenuItem, next: boolean) => {
    if (!token) return;
    setUpdatingId(item.id);
    // Optimistic UI update
    setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, isAvailable: next } : it)));
    try {
      await ShopService.setAvailability(item.id, next, token);
    } catch (e: any) {
      // Revert on failure
      setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, isAvailable: !next } : it)));
      Alert.alert('Update failed', e.message || 'Could not update availability');
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.topBarIcon} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Item Availability</Text>
        <View style={styles.topBarIcon} />
      </View>

      <Text style={styles.hint}>Toggle items to show or hide them from customers in real time.</Text>

      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={COLORS.primary}
          />
        }
      >
        {error && <Text style={styles.errorText}>{error}</Text>}

        {items.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="restaurant-outline" size={48} color={COLORS.textSecondary} />
            <Text style={styles.emptyTitle}>No menu items</Text>
            <Text style={styles.emptySub}>Add items from Menu Management first.</Text>
          </View>
        ) : (
          items.map((item) => (
            <View key={item.id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.meta}>
                  ₱{item.price.toFixed(2)} • {item.category}
                </Text>
              </View>
              {updatingId === item.id ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : (
                <Switch
                  value={!!item.isAvailable}
                  onValueChange={(next) => toggle(item, next)}
                  trackColor={{ true: COLORS.primary, false: COLORS.border }}
                  thumbColor={COLORS.white}
                />
              )}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.backgroundSecondary },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.backgroundSecondary },
  topBar: {
    height: 56,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  topBarIcon: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  topBarTitle: { flex: 1, fontSize: 16, fontWeight: '600', color: COLORS.text, textAlign: 'center' },
  hint: {
    paddingHorizontal: SIZES.screenPadding,
    paddingVertical: 10,
    fontSize: SIZES.smallSize,
    color: COLORS.textSecondary,
  },
  list: { padding: SIZES.screenPadding, paddingBottom: 40 },
  errorText: { color: '#D93025', marginBottom: 12 },
  emptyState: { alignItems: 'center', paddingVertical: 64 },
  emptyTitle: { fontSize: SIZES.bodySize, fontWeight: '600', color: COLORS.text, marginTop: 12 },
  emptySub: { fontSize: SIZES.smallSize, color: COLORS.textSecondary, marginTop: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  name: { fontSize: SIZES.bodySize, fontWeight: '600', color: COLORS.text },
  meta: { fontSize: SIZES.smallSize, color: COLORS.textSecondary, marginTop: 2 },
});
