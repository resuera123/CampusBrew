import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ScrollView,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES } from '../../constants/theme';
import { ReorderItem, ReorderPayload } from '../../services/OrderService';
import { useCart } from '../../context/CartContext';

const DELIVERY_FEE = 10;

export default function ReorderCartScreen({ navigation, route }: any) {
  const { payload } = route.params as { payload: ReorderPayload };
  const { replaceCart } = useCart();

  const [items, setItems] = useState<ReorderItem[]>(payload.items);

  const subtotal = useMemo(
    () => items.reduce((sum, i) => sum + i.currentUnitPrice * i.quantity, 0),
    [items],
  );
  const total = subtotal + (items.length > 0 ? DELIVERY_FEE : 0);

  const setQty = (idx: number, qty: number) => {
    setItems((prev) => {
      const next = [...prev];
      if (qty <= 0) {
        next.splice(idx, 1);
      } else {
        next[idx] = { ...next[idx], quantity: qty, currentTotalPrice: next[idx].currentUnitPrice * qty };
      }
      return next;
    });
  };

  const handleProceed = () => {
    const cartItems = items.map((i, idx) => ({
      cartItemId: `reorder-${Date.now()}-${idx}`,
      menuItemId: i.menuItemId,
      shopId: payload.shopId,
      shopName: payload.shopName,
      itemName: i.itemName,
      image: i.image,
      quantity: i.quantity,
      size: i.size,
      sugarLevel: i.sugarLevel,
      temperature: i.temperature,
      addOns: i.addOns || [],
      unitPrice: i.currentUnitPrice,
    }));
    replaceCart(cartItems, payload.shopId, payload.shopName);
    navigation.navigate('Checkout');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.topBarIcon}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Reorder Cart</Text>
        <View style={styles.topBarIcon} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        {payload.unavailableItems.length > 0 && (
          <View style={styles.notice}>
            <Ionicons name="alert-circle-outline" size={18} color={COLORS.text} />
            <Text style={styles.noticeText}>
              No longer available: {payload.unavailableItems.join(', ')}
            </Text>
          </View>
        )}
        {payload.priceChanges.length > 0 && (
          <View style={[styles.notice, { backgroundColor: COLORS.backgroundSecondary }]}>
            <Ionicons name="information-circle-outline" size={18} color={COLORS.text} />
            <Text style={styles.noticeText}>
              Prices updated for: {payload.priceChanges.map((p) => p.itemName).join(', ')}
            </Text>
          </View>
        )}

        {items.length === 0 ? (
          <View style={styles.emptyBlock}>
            <Text style={styles.emptyText}>Nothing left to reorder</Text>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {items.map((item, idx) => (
              <View key={`${item.menuItemId}-${idx}`} style={styles.itemCard}>
                <View style={styles.itemImage}>
                  {item.image ? (
                    <Image source={{ uri: item.image }} style={styles.itemImageImg} />
                  ) : (
                    <Ionicons name="cafe" size={26} color={COLORS.primary} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{item.itemName}</Text>
                  <Text style={styles.itemShop}>{payload.shopName}</Text>
                  <Text style={styles.itemPrice}>₱{item.currentUnitPrice.toFixed(0)}</Text>
                  <View style={styles.qtyRow}>
                    <Text style={styles.qtyLabel}>Quantity</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <TouchableOpacity style={styles.qtyBtnGhost} onPress={() => setQty(idx, item.quantity - 1)}>
                        <Ionicons name="remove" size={16} color={COLORS.text} />
                      </TouchableOpacity>
                      <Text style={styles.qtyValue}>{item.quantity}</Text>
                      <TouchableOpacity style={styles.qtyBtnFilled} onPress={() => setQty(idx, item.quantity + 1)}>
                        <Ionicons name="add" size={16} color={COLORS.white} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.totalsBlock}>
          <Row label="Subtotal" value={`₱${subtotal.toFixed(0)}`} />
          <Row label="Delivery Fee" value={`₱${(items.length > 0 ? DELIVERY_FEE : 0).toFixed(0)}`} />
          <Row label="Total" value={`₱${total.toFixed(0)}`} bold />
        </View>
        <TouchableOpacity
          style={[styles.proceedBtn, items.length === 0 && { opacity: 0.5 }]}
          onPress={handleProceed}
          disabled={items.length === 0}
          activeOpacity={0.85}
        >
          <Text style={styles.proceedText}>Proceed to Checkout</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={[styles.totalLabel, bold && { color: COLORS.text, fontWeight: '700' }]}>{label}</Text>
      <Text style={[styles.totalValue, bold && { fontWeight: '700' }]}>{value}</Text>
    </View>
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

  content: { flex: 1 },
  contentContainer: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16 },

  notice: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: COLORS.goldLight,
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  noticeText: { flex: 1, fontSize: 12, color: COLORS.text },

  itemCard: { flexDirection: 'row', gap: 12, backgroundColor: COLORS.background, borderRadius: 12, padding: 12 },
  itemImage: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: COLORS.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  itemImageImg: { width: '100%', height: '100%' },
  itemName: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  itemShop: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  itemPrice: { fontSize: 14, fontWeight: '700', color: COLORS.text, marginTop: 4 },

  qtyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  qtyLabel: { fontSize: 12, color: COLORS.textSecondary },
  qtyBtnGhost: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  qtyBtnFilled: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyValue: { fontSize: 14, fontWeight: '600', color: COLORS.text, minWidth: 18, textAlign: 'center' },

  footer: { padding: 16, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.background, gap: 12 },
  totalsBlock: { gap: 6 },
  totalLabel: { fontSize: 13, color: COLORS.textSecondary },
  totalValue: { fontSize: 13, color: COLORS.text },

  proceedBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: SIZES.buttonBorderRadius,
    height: SIZES.buttonHeight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  proceedText: { color: COLORS.white, fontSize: SIZES.buttonFontSize, fontWeight: '600' },

  emptyBlock: { paddingVertical: 48, alignItems: 'center' },
  emptyText: { color: COLORS.textSecondary, fontSize: 14 },
});
