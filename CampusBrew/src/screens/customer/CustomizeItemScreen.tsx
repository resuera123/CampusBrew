import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES } from '../../constants/theme';
import { ShopService, MenuItem } from '../../services/ShopService';
import { useCart, computeUnitPrice } from '../../context/CartContext';

export default function CustomizeItemScreen({ navigation, route }: any) {
  const { menuItemId, shopId } = route.params || {};
  const { addItem, shopId: cartShopId } = useCart();

  const [item, setItem] = useState<MenuItem | null>(null);
  const [shopName, setShopName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [size, setSize] = useState<string | undefined>();
  const [sugarLevel, setSugarLevel] = useState<string | undefined>();
  const [temperature, setTemperature] = useState<string | undefined>();
  const [addOns, setAddOns] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);

  const load = useCallback(async () => {
    try {
      setError(null);
      const menu = await ShopService.getMenu(shopId);
      const found = menu.find((m) => m.id === menuItemId);
      if (!found) throw new Error('Item not found');
      setItem(found);

      const opts = found.customizationOptions;
      if (opts?.sizes?.length) setSize(opts.sizes[Math.min(1, opts.sizes.length - 1)].label);
      if (opts?.sugarLevels?.length) setSugarLevel(opts.sugarLevels[Math.floor(opts.sugarLevels.length / 2)]);
      if (opts?.temperatures?.length) setTemperature(opts.temperatures[0]);

      try {
        const shop = await ShopService.getShop(shopId);
        setShopName(shop.shopName);
      } catch {
        // non-fatal
      }
    } catch (e: any) {
      setError(e.message || 'Could not load item');
    } finally {
      setLoading(false);
    }
  }, [menuItemId, shopId]);

  useEffect(() => {
    load();
  }, [load]);

  const unitPrice = useMemo(() => (item ? computeUnitPrice(item, size, addOns) : 0), [item, size, addOns]);
  const totalPrice = unitPrice * quantity;

  const toggleAddOn = (name: string) => {
    setAddOns((prev) => (prev.includes(name) ? prev.filter((a) => a !== name) : [...prev, name]));
  };

  const handleAddToCart = () => {
    if (!item) return;

    if (cartShopId && cartShopId !== item.shopId) {
      Alert.alert(
        'Switch shop?',
        'Your cart has items from a different shop. Adding this will clear those items.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Switch',
            style: 'destructive',
            onPress: () => doAdd(),
          },
        ],
      );
      return;
    }
    doAdd();
  };

  const doAdd = () => {
    if (!item) return;
    addItem({
      menuItemId: item.id,
      shopId: item.shopId,
      shopName: shopName || 'Shop',
      itemName: item.name,
      image: item.image,
      quantity,
      size,
      sugarLevel,
      temperature,
      addOns,
      unitPrice,
    });
    navigation.goBack();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !item) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.topBarIcon}>
            <Ionicons name="arrow-back" size={22} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>Customize Item</Text>
          <View style={styles.topBarIcon} />
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 }}>
          <Text style={{ color: COLORS.textSecondary }}>{error || 'Item unavailable'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const opts = item.customizationOptions;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.topBarIcon}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Customize Item</Text>
        <View style={styles.topBarIcon} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.heroImage}>
          {item.image ? (
            <Image source={{ uri: item.image }} style={styles.heroImageImg} />
          ) : (
            <Ionicons name="cafe" size={60} color={COLORS.primary} />
          )}
        </View>

        <Text style={styles.itemName}>{item.name}</Text>
        <Text style={styles.itemBasePrice}>₱{item.price.toFixed(0)}</Text>

        {opts?.sizes?.length ? (
          <Section title="Size">
            <View style={styles.pillRow}>
              {opts.sizes.map((s) => {
                const active = s.label === size;
                return (
                  <TouchableOpacity
                    key={s.label}
                    style={[styles.pill, active && styles.pillActive]}
                    onPress={() => setSize(s.label)}
                  >
                    <Text style={[styles.pillText, active && styles.pillTextActive]}>{s.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Section>
        ) : null}

        {opts?.sugarLevels?.length ? (
          <Section title="Sugar Level">
            <View style={styles.pillRow}>
              {opts.sugarLevels.map((s) => {
                const active = s === sugarLevel;
                return (
                  <TouchableOpacity
                    key={s}
                    style={[styles.pill, active && styles.pillActive]}
                    onPress={() => setSugarLevel(s)}
                  >
                    <Text style={[styles.pillText, active && styles.pillTextActive]}>{s}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Section>
        ) : null}

        {opts?.temperatures?.length ? (
          <Section title="Temperature">
            <View style={styles.pillRow}>
              {opts.temperatures.map((t) => {
                const active = t === temperature;
                return (
                  <TouchableOpacity
                    key={t}
                    style={[styles.pill, active && styles.pillActive]}
                    onPress={() => setTemperature(t)}
                  >
                    <Text style={[styles.pillText, active && styles.pillTextActive]}>{t}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Section>
        ) : null}

        {opts?.addOns?.length ? (
          <Section title="Add-ons">
            <View style={{ gap: 10 }}>
              {opts.addOns.map((a) => {
                const checked = addOns.includes(a.name);
                return (
                  <TouchableOpacity key={a.name} style={styles.addOnRow} onPress={() => toggleAddOn(a.name)}>
                    <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                      {checked && <Ionicons name="checkmark" size={14} color={COLORS.white} />}
                    </View>
                    <Text style={styles.addOnLabel}>{a.name}</Text>
                    <Text style={styles.addOnPrice}>₱{a.price.toFixed(0)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Section>
        ) : null}

        <Section title="Quantity">
          <View style={styles.qtyRow}>
            <TouchableOpacity style={styles.qtyBtn} onPress={() => setQuantity(Math.max(1, quantity - 1))}>
              <Ionicons name="remove" size={18} color={COLORS.text} />
            </TouchableOpacity>
            <Text style={styles.qtyValue}>{quantity}</Text>
            <TouchableOpacity style={styles.qtyBtn} onPress={() => setQuantity(quantity + 1)}>
              <Ionicons name="add" size={18} color={COLORS.text} />
            </TouchableOpacity>
          </View>
        </Section>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.addToCartBtn} onPress={handleAddToCart} activeOpacity={0.85}>
          <Text style={styles.addToCartText}>Add to Cart — ₱{totalPrice.toFixed(0)}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 18 }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={{ marginTop: 8 }}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
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

  content: { flex: 1 },
  contentContainer: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32 },

  heroImage: {
    height: 180,
    borderRadius: 12,
    backgroundColor: COLORS.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginBottom: 16,
  },
  heroImageImg: { width: '100%', height: '100%' },

  itemName: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  itemBasePrice: { fontSize: 16, fontWeight: '600', color: COLORS.primary, marginTop: 4 },

  sectionTitle: { fontSize: 14, fontWeight: '600', color: COLORS.text },

  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  pillActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  pillText: { fontSize: 13, color: COLORS.text, fontWeight: '500' },
  pillTextActive: { color: COLORS.white },

  addOnRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  checkboxChecked: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  addOnLabel: { flex: 1, fontSize: 14, color: COLORS.text },
  addOnPrice: { fontSize: 13, fontWeight: '600', color: COLORS.text },

  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  qtyBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  qtyValue: { fontSize: 16, fontWeight: '600', color: COLORS.text, minWidth: 24, textAlign: 'center' },

  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  addToCartBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: SIZES.buttonBorderRadius,
    height: SIZES.buttonHeight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addToCartText: { color: COLORS.white, fontSize: SIZES.buttonFontSize, fontWeight: '600' },
});
