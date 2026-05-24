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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES } from '../../constants/theme';
import { ShopService, Shop, MenuItem } from '../../services/ShopService';
import { useCart } from '../../context/CartContext';

export default function ShopMenuScreen({ navigation, route }: any) {
  const { shopId } = route.params || {};
  const { itemCount } = useCart();

  const [shop, setShop] = useState<Shop | null>(null);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  const load = useCallback(async () => {
    try {
      setError(null);
      const [s, m] = await Promise.all([
        ShopService.getShop(shopId),
        ShopService.getMenu(shopId),
      ]);
      setShop(s);
      setMenu(m);
    } catch (e: any) {
      setError(e.message || 'Could not load menu');
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  useEffect(() => {
    load();
  }, [load]);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    menu.forEach((m) => m.category && cats.add(m.category));
    return ['All', ...Array.from(cats)];
  }, [menu]);

  const visibleMenu = useMemo(() => {
    let list = menu;
    if (activeCategory !== 'All') {
      list = list.filter(
        (m) => (m.category || '').toLowerCase() === activeCategory.toLowerCase(),
      );
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((m) => m.name.toLowerCase().includes(q));
    }
    return list;
  }, [menu, activeCategory, search]);

  const stockBadge = (item: MenuItem) => {
    if (!item.isAvailable) {
      return { label: 'Out of Stock', bg: COLORS.border, color: COLORS.textSecondary };
    }
    if (item.stockStatus?.toLowerCase() === 'low stock') {
      return { label: 'Low Stock', bg: COLORS.goldLight, color: COLORS.text };
    }
    return { label: 'In Stock', bg: COLORS.primary, color: COLORS.white };
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.topBarIcon}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle} numberOfLines={1}>
          {shop?.shopName || 'Shop'}
        </Text>
        <TouchableOpacity style={styles.topBarIcon} onPress={() => navigation.navigate('Checkout')}>
          <Ionicons name="bag-outline" size={22} color={COLORS.text} />
          {itemCount > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{itemCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : error ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 }}>
          <Text style={{ color: COLORS.textSecondary }}>{error}</Text>
          <TouchableOpacity onPress={load} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Search */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={18} color={COLORS.textSecondary} style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search menu items"
              placeholderTextColor={COLORS.textSecondary}
              value={search}
              onChangeText={setSearch}
            />
          </View>

          {/* Category chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 16, marginBottom: 4 }}>
            {categories.map((c) => {
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

          {/* Menu items */}
          {visibleMenu.length === 0 ? (
            <View style={{ paddingVertical: 48, alignItems: 'center' }}>
              <Text style={{ color: COLORS.textSecondary }}>No items match this filter</Text>
            </View>
          ) : (
            <View style={{ gap: 12, marginTop: 16 }}>
              {visibleMenu.map((item) => {
                const badge = stockBadge(item);
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.menuCard, !item.isAvailable && { opacity: 0.5 }]}
                    activeOpacity={0.85}
                    disabled={!item.isAvailable}
                    onPress={() =>
                      navigation.navigate('CustomizeItem', { menuItemId: item.id, shopId: shop?.id || shopId })
                    }
                  >
                    <View style={styles.menuImage}>
                      {item.image ? (
                        <Image source={{ uri: item.image }} style={styles.menuImageImg} />
                      ) : (
                        <Ionicons name="cafe" size={26} color={COLORS.primary} />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Text style={styles.menuName} numberOfLines={1}>{item.name}</Text>
                        <View style={[styles.stockBadge, { backgroundColor: badge.bg }]}>
                          <Text style={[styles.stockBadgeText, { color: badge.color }]}>{badge.label}</Text>
                        </View>
                      </View>
                      {item.description ? (
                        <Text style={styles.menuDesc} numberOfLines={2}>{item.description}</Text>
                      ) : null}
                      <Text style={styles.menuPrice}>₱{item.price.toFixed(0)}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}
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
    paddingHorizontal: 8,
  },
  topBarIcon: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  topBarTitle: { flex: 1, fontSize: 16, fontWeight: '600', color: COLORS.text, textAlign: 'center' },

  cartBadge: {
    position: 'absolute',
    top: 6,
    right: 4,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartBadgeText: { color: COLORS.white, fontSize: 10, fontWeight: '700' },

  content: { flex: 1 },
  contentContainer: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32 },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: SIZES.inputHeight,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: SIZES.inputBorderRadius,
    backgroundColor: COLORS.background,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  searchInput: { flex: 1, fontSize: SIZES.inputFontSize, color: COLORS.text },

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

  menuCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 12,
  },
  menuImage: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: COLORS.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  menuImageImg: { width: '100%', height: '100%' },
  menuName: { fontSize: 14, fontWeight: '600', color: COLORS.text, flex: 1, marginRight: 8 },
  menuDesc: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  menuPrice: { fontSize: 14, fontWeight: '700', color: COLORS.text, marginTop: 6 },

  stockBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  stockBadgeText: { fontSize: 10, fontWeight: '700' },

  retryBtn: { paddingHorizontal: 20, paddingVertical: 8, borderWidth: 1, borderColor: COLORS.primary, borderRadius: 18 },
  retryText: { color: COLORS.primary, fontWeight: '600' },
});
