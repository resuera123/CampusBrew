import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SIZES } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { DeliveryService } from '../../services/DeliveryService';
import { Order } from '../../services/OrderService';

export default function AssignedDeliveryScreen({ navigation }: any) {
  const { token } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setError(null);
      const o = await DeliveryService.getCurrentOrder(token);
      setOrder(o);
    } catch (e: any) {
      setError(e.message || 'Could not load current delivery');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handlePickup = async () => {
    if (!order || !token) return;
    setSubmitting(true);
    try {
      const updated = await DeliveryService.markPickedUp(order.id, token);
      setOrder(updated);
    } catch (e: any) {
      Alert.alert('Could not mark picked up', e.message || 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleComplete = async () => {
    if (!order || !token) return;
    const isCod = order.paymentMethod === 'COD';
    const confirmText = isCod
      ? `Have you collected ₱${order.totalAmount.toFixed(2)} in cash from the customer?`
      : 'Confirm the order was delivered?';
    Alert.alert(
      'Confirm delivery',
      confirmText,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setSubmitting(true);
            try {
              await DeliveryService.confirmDelivery(order.id, token);
              Alert.alert('Delivered', 'This order is complete.');
              setOrder(null);
              navigation.goBack();
            } catch (e: any) {
              Alert.alert('Could not confirm', e.message || 'Please try again.');
            } finally {
              setSubmitting(false);
            }
          },
        },
      ],
    );
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
        {navigation.canGoBack() ? (
          <TouchableOpacity style={styles.topBarIcon} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color={COLORS.text} />
          </TouchableOpacity>
        ) : (
          <View style={styles.topBarIcon} />
        )}
        <Text style={styles.topBarTitle}>Current Delivery</Text>
        <View style={styles.topBarIcon} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
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

        {!order ? (
          <View style={styles.emptyState}>
            <Ionicons name="bicycle-outline" size={48} color={COLORS.textSecondary} />
            <Text style={styles.emptyTitle}>No active delivery</Text>
            <Text style={styles.emptySub}>You'll see your current delivery here once you accept one.</Text>
          </View>
        ) : (
          <>
            <View style={styles.headerCard}>
              <Text style={styles.orderId}>#{order.id.slice(-6).toUpperCase()}</Text>
              <StatusBadge status={order.orderStatus} />
            </View>

            <SectionTitle text="Pickup" />
            <View style={styles.card}>
              <Row label="Shop" value={order.shopName ?? '—'} />
              <Row label="Beverage cost" value={`₱${order.beverageSubtotal.toFixed(2)}`} highlight />
              <Text style={styles.cardHint}>
                Pay this amount upfront to the shop, then collect the items.
              </Text>
            </View>

            <SectionTitle text="Drop-off" />
            <View style={styles.card}>
              <Row label="Location" value={order.deliveryLocation} />
              <Row label="Payment" value={order.paymentMethod === 'COD' ? 'Cash on Delivery' : 'GCash (prepaid)'} />
              {order.paymentMethod === 'COD' ? (
                <Row label="Collect" value={`₱${order.totalAmount.toFixed(2)}`} highlight />
              ) : (
                <Row label="Already paid" value="No collection needed" />
              )}
              {order.dasherInstructions ? (
                <View style={styles.instructionsBox}>
                  <Ionicons name="chatbubble-ellipses-outline" size={16} color={COLORS.primary} />
                  <Text style={styles.instructionsText}>{order.dasherInstructions}</Text>
                </View>
              ) : null}
            </View>

            <SectionTitle text="Items" />
            <View style={styles.card}>
              {order.items.map((it, idx) => (
                <View key={idx} style={styles.itemRow}>
                  <Text style={styles.itemQty}>{it.quantity}×</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>{it.itemName}</Text>
                    {(it.size || it.sugarLevel || it.temperature) && (
                      <Text style={styles.itemMods}>
                        {[it.size, it.sugarLevel, it.temperature].filter(Boolean).join(' • ')}
                      </Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>

      {order && order.orderStatus === 'ASSIGNED' && (
        <TouchableOpacity style={styles.primaryBtn} onPress={handlePickup} disabled={submitting}>
          {submitting
            ? <ActivityIndicator color={COLORS.white} />
            : <Text style={styles.primaryBtnText}>Mark as Picked Up</Text>}
        </TouchableOpacity>
      )}

      {order && order.orderStatus === 'OUT_FOR_DELIVERY' && (
        <TouchableOpacity style={styles.primaryBtn} onPress={handleComplete} disabled={submitting}>
          {submitting
            ? <ActivityIndicator color={COLORS.white} />
            : <Text style={styles.primaryBtnText}>
                {order.paymentMethod === 'COD' ? 'Confirm Cash Received & Delivered' : 'Confirm Delivery'}
              </Text>}
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

function SectionTitle({ text }: { text: string }) {
  return <Text style={styles.sectionTitle}>{text}</Text>;
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, highlight && styles.rowValueHighlight]}>{value}</Text>
    </View>
  );
}

function StatusBadge({ status }: { status: Order['orderStatus'] }) {
  const map: Record<string, { bg: string; fg: string; label: string }> = {
    ASSIGNED: { bg: '#FFF4D6', fg: '#7A5A00', label: 'Pick up' },
    OUT_FOR_DELIVERY: { bg: '#E0F0FF', fg: '#0A66B5', label: 'On the way' },
    DELIVERED: { bg: '#E6F4EA', fg: '#1E8E3E', label: 'Delivered' },
  };
  const s = map[status] ?? { bg: '#E8E8E8', fg: '#3A3A3A', label: status };
  return (
    <View style={[styles.badge, { backgroundColor: s.bg }]}>
      <Text style={[styles.badgeText, { color: s.fg }]}>{s.label}</Text>
    </View>
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
  content: { padding: SIZES.screenPadding, paddingBottom: 120 },
  errorText: { color: '#D93025', marginBottom: 12 },
  emptyState: { alignItems: 'center', paddingVertical: 64 },
  emptyTitle: { fontSize: SIZES.bodySize, fontWeight: '600', color: COLORS.text, marginTop: 12 },
  emptySub: { fontSize: SIZES.smallSize, color: COLORS.textSecondary, marginTop: 4, textAlign: 'center' },
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  orderId: { fontSize: SIZES.titleSize, fontWeight: '700', color: COLORS.text },
  badge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 },
  badgeText: { fontSize: SIZES.smallSize, fontWeight: '600' },
  sectionTitle: { fontSize: SIZES.bodySize, fontWeight: '600', color: COLORS.text, marginBottom: 8, marginTop: 4 },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  cardHint: { fontSize: SIZES.smallSize, color: COLORS.textSecondary, marginTop: 8 },
  instructionsBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
  },
  instructionsText: { flex: 1, fontSize: SIZES.smallSize, color: COLORS.text, lineHeight: 18 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  rowLabel: { fontSize: SIZES.captionSize, color: COLORS.textSecondary },
  rowValue: { fontSize: SIZES.captionSize, color: COLORS.text, fontWeight: '500', flex: 1, textAlign: 'right' },
  rowValueHighlight: { color: COLORS.primary, fontWeight: '700' },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 6 },
  itemQty: { width: 28, fontSize: SIZES.captionSize, fontWeight: '600', color: COLORS.text },
  itemName: { fontSize: SIZES.captionSize, color: COLORS.text },
  itemMods: { fontSize: SIZES.smallSize, color: COLORS.textSecondary, marginTop: 1 },
  primaryBtn: {
    position: 'absolute',
    left: SIZES.screenPadding,
    right: SIZES.screenPadding,
    bottom: 24,
    height: SIZES.buttonHeight,
    backgroundColor: COLORS.primary,
    borderRadius: SIZES.buttonBorderRadius,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryBtnText: { color: COLORS.white, fontSize: SIZES.buttonFontSize, fontWeight: '600' },
});
