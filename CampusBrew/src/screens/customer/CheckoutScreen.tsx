import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES } from '../../constants/theme';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { PaymentMethod } from '../../services/OrderService';
import { placeOrderWithPayment } from '../../services/PaymentService';
import { showAlert } from '../../components/AppAlert';

// Customer-visible delivery charge. Backend's PLATFORM_COMMISSION (₱5) is
// taken from this amount — not shown as a separate line on checkout.
// These mirror the server's ConfigService defaults; the server is authoritative
// and re-checks them, so the UI only needs them for display and gating.
const DELIVERY_FEE = 15;
const COD_LIMIT = 300; // v2.0 FR-2.2
const TIP_PRESETS = [0, 5, 10, 20]; // v2.0 FR-4.7
const TIP_MAX = 100;

export default function CheckoutScreen({ navigation }: any) {
  const { items, shopId, shopName, subtotal, clearCart, removeItem } = useCart();
  const { user, token } = useAuth();
  const isVerified = user?.verificationStatus === 'VERIFIED';

  const [deliveryLocation, setDeliveryLocation] = useState('');
  const [dasherInstructions, setDasherInstructions] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('GCASH');
  const [tip, setTip] = useState(0);
  const [customTip, setCustomTip] = useState('');
  const [placing, setPlacing] = useState(false);

  const deliveryFee = items.length > 0 ? DELIVERY_FEE : 0;
  const total = subtotal + deliveryFee + tip;

  // v2.0 FR-2.2 — COD is only available when verified AND at or under the ₱300 ceiling
  // (which includes the tip). If the tip pushes the total over, fall back to GCash.
  const codAllowed = isVerified && total <= COD_LIMIT;
  useEffect(() => {
    if (paymentMethod === 'COD' && !codAllowed) setPaymentMethod('GCASH');
  }, [codAllowed, paymentMethod]);

  const handleConfirm = async () => {
    if (items.length === 0 || !shopId) {
      showAlert('Cart is empty', 'Add some items before checking out.');
      return;
    }
    if (!deliveryLocation.trim()) {
      showAlert('Delivery location required', 'Tell us where to deliver your order.');
      return;
    }
    if (paymentMethod === 'COD' && !isVerified) {
      showAlert('Verification required', 'Cash on Delivery is only available for verified CIT-U accounts.');
      return;
    }
    if (!token) {
      showAlert('Please log in', 'You need to be logged in to place an order.');
      return;
    }

    setPlacing(true);
    try {
      // v2.0 FR-4.1 — placeOrderWithPayment handles both paths: COD returns an order
      // id immediately; GCash opens the Xendit checkout, waits for PAID, then returns
      // the id of the order the webhook created. The order only exists once paid.
      const result = await placeOrderWithPayment(
        {
          shopId,
          deliveryLocation: deliveryLocation.trim(),
          dasherInstructions: dasherInstructions.trim() || undefined,
          paymentMethod,
          tip,
          items: items.map((i) => ({
            menuItemId: i.menuItemId,
            quantity: i.quantity,
            size: i.size,
            sugarLevel: i.sugarLevel,
            temperature: i.temperature,
            addOns: i.addOns,
            optionsHash: i.optionsHash,
          })),
        },
        token,
      );

      if ('orderId' in result) {
        clearCart();
        // Route straight into the tracking screen. `replace` so the back stack
        // doesn't return to the now-empty checkout.
        navigation.replace('OrderTracking', { orderId: result.orderId });
      } else if (result.status === 'FAILED' || result.status === 'EXPIRED') {
        // Keep the cart so they can retry; no order was created.
        showAlert('Payment not completed',
          'Your GCash payment was not completed, so no order was placed.');
      } else {
        // PENDING — they closed the checkout before we saw the payment land.
        showAlert('Payment pending',
          'We didn\'t get confirmation of your payment. If you were charged, your '
          + 'order will appear shortly — check your order history.');
      }
    } catch (e: any) {
      showAlert('Could not place order', e.message || 'Try again.');
    } finally {
      setPlacing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.topBarIcon}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Checkout</Text>
        <View style={styles.topBarIcon} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        {/* Your Cart */}
        <Text style={styles.sectionTitle}>Your Cart</Text>
        {items.length === 0 ? (
          <View style={styles.emptyBlock}>
            <Ionicons name="bag-outline" size={28} color={COLORS.textSecondary} />
            <Text style={styles.emptyText}>Your cart is empty</Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {items.map((i) => (
              <View key={i.cartItemId} style={styles.cartItem}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={styles.cartItemName}>{i.itemName}</Text>
                    <Text style={styles.cartItemPrice}>₱{(i.unitPrice * i.quantity).toFixed(0)}</Text>
                  </View>
                  <Text style={styles.cartItemShop}>{shopName}</Text>
                  <Text style={styles.cartItemMeta}>
                    {[
                      i.size,
                      i.sugarLevel ? `${i.sugarLevel} Sugar` : null,
                      i.temperature,
                      ...(i.addOns || []).map((a) => `+${a}`),
                      `x${i.quantity}`,
                    ]
                      .filter(Boolean)
                      .join(', ')}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => removeItem(i.cartItemId)} style={{ marginLeft: 10 }}>
                  <Ionicons name="trash-outline" size={18} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Delivery Location */}
        <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Delivery Location</Text>
        <View style={styles.locationInput}>
          <Ionicons name="location-outline" size={18} color={COLORS.primary} style={{ marginRight: 8 }} />
          <TextInput
            style={{ flex: 1, fontSize: SIZES.inputFontSize, color: COLORS.text }}
            placeholder="e.g. Main Building, Room 203"
            placeholderTextColor={COLORS.textSecondary}
            value={deliveryLocation}
            onChangeText={setDeliveryLocation}
          />
        </View>

        {/* Dasher Instructions */}
        <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Dasher Instructions</Text>
        <View style={[styles.locationInput, { alignItems: 'flex-start', minHeight: 72 }]}>
          <Ionicons name="chatbubble-ellipses-outline" size={18} color={COLORS.primary} style={{ marginRight: 8, marginTop: 4 }} />
          <TextInput
            style={{ flex: 1, fontSize: SIZES.inputFontSize, color: COLORS.text, minHeight: 60, textAlignVertical: 'top' }}
            placeholder="Optional — gate code, building entry, allergies, leave at door, etc."
            placeholderTextColor={COLORS.textSecondary}
            value={dasherInstructions}
            onChangeText={setDasherInstructions}
            multiline
            maxLength={250}
          />
        </View>

        {/* Tip — v2.0 FR-4.7. Goes 100% to your dasher. */}
        <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Tip your dasher</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
          {TIP_PRESETS.map((amt) => {
            const selected = customTip === '' && tip === amt;
            return (
              <TouchableOpacity
                key={amt}
                style={[styles.tipChip, selected && styles.tipChipSelected]}
                onPress={() => { setCustomTip(''); setTip(amt); }}
              >
                <Text style={[styles.tipChipText, selected && styles.tipChipTextSelected]}>
                  {amt === 0 ? 'No tip' : `₱${amt}`}
                </Text>
              </TouchableOpacity>
            );
          })}
          <View style={[styles.tipChip, customTip !== '' && styles.tipChipSelected, { flexDirection: 'row', alignItems: 'center', minWidth: 90 }]}>
            <Text style={[styles.tipChipText, customTip !== '' && styles.tipChipTextSelected]}>₱</Text>
            <TextInput
              style={{ flex: 1, fontSize: SIZES.inputFontSize, color: customTip !== '' ? COLORS.white : COLORS.text, paddingVertical: 0 }}
              placeholder="Custom"
              placeholderTextColor={COLORS.textSecondary}
              keyboardType="number-pad"
              value={customTip}
              onChangeText={(t) => {
                const digits = t.replace(/[^0-9]/g, '');
                setCustomTip(digits);
                const n = Math.min(parseInt(digits || '0', 10), TIP_MAX);
                setTip(isNaN(n) ? 0 : n);
              }}
              maxLength={3}
            />
          </View>
        </View>

        {/* Payment Method */}
        <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Payment Method</Text>
        <View style={{ gap: 10, marginTop: 8 }}>
          <PaymentRow
            selected={paymentMethod === 'GCASH'}
            onPress={() => setPaymentMethod('GCASH')}
            label="GCash"
            leading={
              <View style={[styles.payIcon, { backgroundColor: COLORS.gcashBlue }]}>
                <Text style={{ color: COLORS.white, fontWeight: '700' }}>G</Text>
              </View>
            }
          />
          <PaymentRow
            selected={paymentMethod === 'COD'}
            onPress={() => {
              if (!isVerified) {
                showAlert('Verify your account', 'Cash on Delivery is unlocked when you verify your CIT-U email.');
                return;
              }
              if (total > COD_LIMIT) {
                showAlert(`Over ₱${COD_LIMIT}`, `Cash on Delivery is only for orders up to ₱${COD_LIMIT}. Please pay with GCash.`);
                return;
              }
              setPaymentMethod('COD');
            }}
            label="Cash on Delivery"
            disabled={!codAllowed}
            trailing={
              <View style={[styles.verifiedBadge, !codAllowed && { backgroundColor: COLORS.border }]}>
                <Text style={[styles.verifiedBadgeText, !codAllowed && { color: COLORS.textSecondary }]}>
                  {!isVerified ? 'Verify first' : total > COD_LIMIT ? `Over ₱${COD_LIMIT}` : 'Verified'}
                </Text>
              </View>
            }
          />
        </View>

        {/* Summary */}
        <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Order Summary</Text>
        <View style={styles.summary}>
          <Row label="Subtotal" value={`₱${subtotal.toFixed(0)}`} />
          <Row label="Delivery Fee" value={`₱${deliveryFee.toFixed(0)}`} />
          {tip > 0 && <Row label="Tip" value={`₱${tip.toFixed(0)}`} />}
          <View style={styles.divider} />
          <Row label="Total" value={`₱${total.toFixed(0)}`} bold />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.confirmBtn, (placing || items.length === 0) && { opacity: 0.6 }]}
          disabled={placing || items.length === 0}
          onPress={handleConfirm}
          activeOpacity={0.85}
        >
          {placing ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Text style={styles.confirmText}>Confirm Order</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function PaymentRow({
  selected,
  onPress,
  label,
  leading,
  trailing,
  disabled,
}: {
  selected: boolean;
  onPress: () => void;
  label: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.payRow, selected && styles.payRowSelected, disabled && { opacity: 0.6 }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={[styles.radioOuter, selected && { borderColor: COLORS.primary }]}>
        {selected && <View style={styles.radioInner} />}
      </View>
      {leading}
      <Text style={styles.payLabel}>{label}</Text>
      {trailing}
    </TouchableOpacity>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, bold && { fontWeight: '700', color: COLORS.text }]}>{label}</Text>
      <Text style={[styles.rowValue, bold && { fontWeight: '700' }]}>{value}</Text>
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
  contentContainer: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32 },

  sectionTitle: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 8 },

  cartItem: { flexDirection: 'row', backgroundColor: COLORS.background, borderRadius: 12, padding: 12, alignItems: 'center' },
  cartItemName: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  cartItemPrice: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  cartItemShop: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  cartItemMeta: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },

  locationInput: {
    flexDirection: 'row',
    alignItems: 'center',
    height: SIZES.inputHeight,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: SIZES.inputBorderRadius,
    backgroundColor: COLORS.background,
    paddingHorizontal: 14,
    marginTop: 8,
  },

  payRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 12,
  },
  payRowSelected: { borderColor: COLORS.primary },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary },
  payIcon: { width: 28, height: 28, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  payLabel: { flex: 1, fontSize: 14, color: COLORS.text, fontWeight: '500' },
  verifiedBadge: { backgroundColor: COLORS.goldLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  verifiedBadgeText: { fontSize: 11, fontWeight: '700', color: COLORS.text },
  tipChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.white,
  },
  tipChipSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tipChipText: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  tipChipTextSelected: { color: COLORS.white },

  summary: { backgroundColor: COLORS.background, borderRadius: 12, padding: 14, marginTop: 8, gap: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  rowLabel: { fontSize: 13, color: COLORS.textSecondary },
  rowValue: { fontSize: 13, color: COLORS.text },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 4 },

  footer: { padding: 16, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.background },
  confirmBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: SIZES.buttonBorderRadius,
    height: SIZES.buttonHeight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmText: { color: COLORS.white, fontSize: SIZES.buttonFontSize, fontWeight: '600' },

  emptyBlock: { paddingVertical: 24, alignItems: 'center', gap: 8 },
  emptyText: { color: COLORS.textSecondary, fontSize: 13 },
});
