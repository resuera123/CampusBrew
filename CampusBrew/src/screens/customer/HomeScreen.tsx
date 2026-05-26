import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  Image,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES } from '../../constants/theme';
import { ShopService, Shop, MenuItem } from '../../services/ShopService';
import { useCart } from '../../context/CartContext';
import { useNotifications } from '../../context/NotificationsContext';
import CurrentOrderBanner from './CurrentOrderBanner';

const CATEGORIES = ['All', 'Coffee', 'Milk Tea', 'Fruit Tea', 'Smoothie'];

export default function HomeScreen({ navigation }: any) {
  const { items: cartItems } = useCart();
  const cartCount = cartItems.reduce((sum, i) => sum + i.quantity, 0);
  const { unreadCount } = useNotifications();
  const [shops, setShops] = useState<Shop[]>([]);
  const [popular, setPopular] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  const load = useCallback(async () => {
    try {
      setError(null);
      const shopList = await ShopService.getShops(false);
      setShops(shopList);

      // Popular Picks: pull menu of first available shop to give the home a populated feel.
      if (shopList.length > 0) {
        try {
          const menu = await ShopService.getMenu(shopList[0].id);
          setPopular(menu.filter((m) => m.isAvailable).slice(0, 4));
        } catch {
          setPopular([]);
        }
      } else {
        setPopular([]);
      }
    } catch (e: any) {
      setError(e.message || 'Could not load shops');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const filteredPopular = useMemo(() => {
    let list = popular;
    if (activeCategory !== 'All') {
      list = list.filter(
        (p) => (p.category || '').toLowerCase() === activeCategory.toLowerCase(),
      );
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q));
    }
    return list;
  }, [popular, activeCategory, search]);

  const filteredShops = useMemo(() => {
    if (!search.trim()) return shops;
    const q = search.trim().toLowerCase();
    return shops.filter((s) => s.shopName.toLowerCase().includes(q));
  }, [shops, search]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      <View style={styles.topBar}>
        <Text style={styles.topBarTitle}>CIT-U Campus Beverage Delivery</Text>
        <TouchableOpacity
          style={styles.topBarIcon}
          onPress={() => navigation.navigate('Notifications')}
        >
          <Ionicons name="notifications-outline" size={22} color={COLORS.text} />
          {unreadCount > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.topBarIcon}
          onPress={() => navigation.navigate('Checkout')}
        >
          <Ionicons name="bag-outline" size={22} color={COLORS.text} />
          {cartCount > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{cartCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
      >
        {/* Search */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color={COLORS.textSecondary} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search drinks or shops"
            placeholderTextColor={COLORS.textSecondary}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {loading ? (
          <View style={{ paddingVertical: 48, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : error ? (
          <View style={styles.emptyBlock}>
            <Text style={styles.emptyText}>{error}</Text>
            <TouchableOpacity onPress={load} style={styles.retryBtn}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Partner Shops */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Partner Shops</Text>
              <TouchableOpacity>
                <Text style={styles.viewAll}>View All</Text>
              </TouchableOpacity>
            </View>

            {filteredShops.length === 0 ? (
              <View style={styles.emptyBlock}>
                <Ionicons name="storefront-outline" size={28} color={COLORS.textSecondary} />
                <Text style={styles.emptyText}>No shops yet</Text>
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingRight: 16 }}
              >
                {filteredShops.map((shop) => (
                  <TouchableOpacity
                    key={shop.id}
                    style={styles.shopCard}
                    activeOpacity={0.85}
                    onPress={() => navigation.navigate('ShopMenu', { shopId: shop.id })}
                  >
                    <View style={styles.shopImage}>
                      {shop.shopImage ? (
                        <Image source={{ uri: shop.shopImage }} style={styles.shopImageImg} />
                      ) : (
                        <Ionicons name="cafe" size={28} color={COLORS.primary} />
                      )}
                    </View>
                    <Text style={styles.shopName} numberOfLines={1}>
                      {shop.shopName}
                    </Text>
                    <Text style={styles.shopMeta}>
                      {shop.estimatedPrepTime || (shop.isOpen ? 'Open now' : 'Closed')}
                    </Text>
                    <View style={styles.ratingRow}>
                      <Ionicons name="star" size={12} color={COLORS.gold} />
                      <Text style={styles.ratingText}>{shop.rating?.toFixed(1) ?? '—'}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {/* Categories */}
            <Text style={[styles.sectionTitle, { marginTop: 24, marginBottom: 12 }]}>Categories</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 16 }}>
              {CATEGORIES.map((c) => {
                const active = c === activeCategory;
                return (
                  <TouchableOpacity
                    key={c}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setActiveCategory(c)}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{c}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Popular Picks */}
            <Text style={[styles.sectionTitle, { marginTop: 24, marginBottom: 12 }]}>Popular Picks</Text>
            {filteredPopular.length === 0 ? (
              <View style={styles.emptyBlock}>
                <Text style={styles.emptyText}>No items yet</Text>
              </View>
            ) : (
              <View style={styles.popularGrid}>
                {filteredPopular.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.popularCard}
                    activeOpacity={0.85}
                    onPress={() =>
                      navigation.navigate('CustomizeItem', { menuItemId: item.id, shopId: item.shopId })
                    }
                  >
                    <View style={styles.popularImage}>
                      {item.image ? (
                        <Image source={{ uri: item.image }} style={styles.popularImageImg} />
                      ) : (
                        <Ionicons name="cafe-outline" size={28} color={COLORS.primary} />
                      )}
                    </View>
                    <Text style={styles.popularName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.popularShop} numberOfLines={1}>
                      {shops.find((s) => s.id === item.shopId)?.shopName || ''}
                    </Text>
                    <View style={styles.popularBottom}>
                      <Text style={styles.popularPrice}>₱{item.price.toFixed(0)}</Text>
                      <View style={styles.addBtn}>
                        <Ionicons name="add" size={16} color={COLORS.white} />
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      <CurrentOrderBanner navigation={navigation} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.backgroundSecondary },
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
  topBarTitle: { fontSize: 14, fontWeight: '600', color: COLORS.text, flex: 1 },
  topBarIcon: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  cartBadge: {
    position: 'absolute',
    top: 4,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  cartBadgeText: { color: COLORS.white, fontSize: 10, fontWeight: '700' },

  content: { flex: 1 },
  contentContainer: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 120 },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: SIZES.inputHeight,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: SIZES.inputBorderRadius,
    backgroundColor: COLORS.background,
    paddingHorizontal: 14,
    marginBottom: 20,
  },
  searchInput: { flex: 1, fontSize: SIZES.inputFontSize, color: COLORS.text },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  viewAll: { color: COLORS.primary, fontSize: 13, fontWeight: '600' },

  shopCard: {
    width: 140,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 12,
    marginRight: 12,
  },
  shopImage: {
    height: 56,
    borderRadius: 8,
    backgroundColor: COLORS.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    overflow: 'hidden',
  },
  shopImageImg: { width: '100%', height: '100%' },
  shopName: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  shopMeta: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  ratingText: { fontSize: 12, color: COLORS.text, fontWeight: '600' },

  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    marginRight: 8,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 13, color: COLORS.text, fontWeight: '500' },
  chipTextActive: { color: COLORS.white },

  popularGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  popularCard: {
    width: '48%',
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  popularImage: {
    height: 64,
    borderRadius: 8,
    backgroundColor: COLORS.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    overflow: 'hidden',
  },
  popularImageImg: { width: '100%', height: '100%' },
  popularName: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  popularShop: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  popularBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  popularPrice: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  addBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },

  emptyBlock: { paddingVertical: 24, alignItems: 'center', gap: 8 },
  emptyText: { color: COLORS.textSecondary, fontSize: 13 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 8, borderWidth: 1, borderColor: COLORS.primary, borderRadius: 18 },
  retryText: { color: COLORS.primary, fontWeight: '600' },
});
