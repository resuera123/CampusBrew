import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SIZES } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { DeliveryService } from '../../services/DeliveryService';
import { Order } from '../../services/OrderService';

const POLL_INTERVAL_MS = 5000;
const EXPIRY_MS = 10 * 60 * 1000; // matches backend delivery.orderExpiry.minutes

interface Props {
  /** Called when the DP successfully claims an order, so the parent can swap to AssignedDelivery view. */
  onClaimed?: () => void;
}

/**
 * Marketplace list. Any active DP can tap a card to claim. Server enforces
 * first-wins atomically — losing the race surfaces a friendly "already claimed".
 */
export default function AvailableDeliveriesScreen({ onClaimed }: Props) {
  const { token } = useAuth();
  const { socket } = useSocket();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!token) return;
    try {
      if (!silent) setError(null);
      const list = await DeliveryService.getAvailableDeliveries(token);
      setOrders(list);
    } catch (e: any) {
      if (!silent) setError(e.message || 'Could not load available orders');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useFocusEffect(useCallback(() => {
    load();
    pollRef.current = setInterval(() => load(true), POLL_INTERVAL_MS);
    // Re-render every second so the per-card countdown ticks down even between polls.
    tickRef.current = setInterval(() => setTick((n) => n + 1), 1000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
      pollRef.current = null;
      tickRef.current = null;
    };
  }, [load]));

  // Realtime: refresh the marketplace when an order becomes available, gets
  // claimed by another DP, or any status changes. Polling is the safety net.
  useEffect(() => {
    if (!socket) return;
    const onAny = () => load(true);
    socket.on('order:statusUpdate', onAny);
    socket.on('delivery:claimed', onAny);
    socket.on('delivery:request', onAny);
    return () => {
      socket.off('order:statusUpdate', onAny);
      socket.off('delivery:claimed', onAny);
      socket.off('delivery:request', onAny);
    };
  }, [socket, load]);

  const handleClaim = async (order: Order) => {
    if (!token) return;
    setClaimingId(order.id);
    try {
      await DeliveryService.claimOrder(order.id, token);
      setOrders((prev) => prev.filter((o) => o.id !== order.id));
      onClaimed?.();
    } catch (e: any) {
      Alert.alert('Could not claim', e.message || 'Try another order.');
      // Refresh the list — the order may have been claimed by someone else.
      load();
    } finally {
      setClaimingId(null);
    }
  };

  const confirmClaim = (order: Order) => {
    Alert.alert(
      'Accept this delivery?',
      `${order.shopName ?? 'Shop'} → ${order.deliveryLocation}\n₱${order.totalAmount.toFixed(2)}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Accept', onPress: () => handleClaim(order) },
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
      <View style={styles.header}>
        <Text style={styles.title}>Available Deliveries</Text>
        <Text style={styles.subtitle}>
          {orders.length} order{orders.length !== 1 ? 's' : ''} waiting · tap to accept
        </Text>
      </View>

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
        {error && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={18} color="#D93025" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {orders.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="bicycle-outline" size={48} color={COLORS.textSecondary} />
            <Text style={styles.emptyTitle}>No orders right now</Text>
            <Text style={styles.emptySub}>
              New deliveries appear here as soon as a shop marks an order ready.
            </Text>
          </View>
        ) : (
          orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              claiming={claimingId === order.id}
              onClaim={() => confirmClaim(order)}
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function OrderCard({
  order,
  claiming,
  onClaim,
}: {
  order: Order;
  claiming: boolean;
  onClaim: () => void;
}) {
  const itemCount = order.items.reduce((sum, it) => sum + (it.quantity || 0), 0);
  const expiresAt = order.readyAt ? new Date(order.readyAt).getTime() + EXPIRY_MS : null;
  const msLeft = expiresAt ? Math.max(0, expiresAt - Date.now()) : null;
  const expiring = msLeft != null && msLeft < 2 * 60 * 1000; // <2 min

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={onClaim} disabled={claiming}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={styles.shopName} numberOfLines={1}>{order.shopName ?? 'Shop'}</Text>
          <Text style={styles.orderId}>#{order.id.slice(-6).toUpperCase()}</Text>
        </View>
        <View style={[styles.timerPill, expiring && styles.timerPillUrgent]}>
          <Ionicons name="time-outline" size={12} color={expiring ? '#7A2C33' : COLORS.textSecondary} />
          <Text style={[styles.timerText, expiring && styles.timerTextUrgent]}>
            {msLeft != null ? formatCountdown(msLeft) : '—'}
          </Text>
        </View>
      </View>

      <View style={styles.row}>
        <Ionicons name="location-outline" size={14} color={COLORS.textSecondary} />
        <Text style={styles.rowText} numberOfLines={1}>{order.deliveryLocation}</Text>
      </View>

      <View style={styles.metaRow}>
        <Text style={styles.metaText}>{itemCount} item{itemCount !== 1 ? 's' : ''}</Text>
        <Text style={styles.metaText}>·</Text>
        <Text style={styles.metaText}>₱{order.totalAmount.toFixed(2)}</Text>
        <Text style={styles.metaText}>·</Text>
        <Text style={styles.metaText}>{order.paymentMethod === 'COD' ? 'Cash' : 'GCash'}</Text>
      </View>

      <View style={styles.cta}>
        {claiming
          ? <ActivityIndicator color={COLORS.white} />
          : <Text style={styles.ctaText}>Accept Delivery</Text>}
      </View>
    </TouchableOpacity>
  );
}

function formatCountdown(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const ss = String(totalSec % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.backgroundSecondary },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.backgroundSecondary },
  header: { paddingHorizontal: SIZES.screenPadding, paddingTop: 8, paddingBottom: 4 },
  title: { fontSize: SIZES.titleSize, fontWeight: '700', color: COLORS.text },
  subtitle: { fontSize: SIZES.smallSize, color: COLORS.textSecondary, marginTop: 2 },
  list: { padding: SIZES.screenPadding, paddingBottom: 40 },
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FCE8E8', borderRadius: 8, padding: 10, marginBottom: 12,
  },
  errorText: { color: '#D93025', flex: 1, fontSize: SIZES.smallSize },
  emptyState: { alignItems: 'center', paddingVertical: 64 },
  emptyTitle: { fontSize: SIZES.bodySize, fontWeight: '600', color: COLORS.text, marginTop: 12 },
  emptySub: { fontSize: SIZES.smallSize, color: COLORS.textSecondary, marginTop: 4, textAlign: 'center', paddingHorizontal: 24 },
  card: { backgroundColor: COLORS.white, borderRadius: 12, padding: 14, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  shopName: { fontSize: SIZES.bodySize, fontWeight: '700', color: COLORS.text },
  orderId: { fontSize: SIZES.smallSize, color: COLORS.textSecondary, marginTop: 2 },
  timerPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10,
    backgroundColor: COLORS.backgroundSecondary,
  },
  timerPillUrgent: { backgroundColor: '#FCE4E6' },
  timerText: { fontSize: SIZES.smallSize, color: COLORS.textSecondary, fontWeight: '600' },
  timerTextUrgent: { color: '#7A2C33' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2 },
  rowText: { fontSize: SIZES.captionSize, color: COLORS.text, flex: 1 },
  metaRow: { flexDirection: 'row', gap: 6, marginTop: 6 },
  metaText: { fontSize: SIZES.smallSize, color: COLORS.textSecondary },
  cta: {
    marginTop: 12, height: 40, backgroundColor: COLORS.primary,
    borderRadius: 20, justifyContent: 'center', alignItems: 'center',
  },
  ctaText: { color: COLORS.white, fontWeight: '600', fontSize: SIZES.captionSize },
});
