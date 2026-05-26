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
import { Order, OrderStatus } from '../../services/OrderService';
import { ShopOrderService } from '../../services/ShopOrderService';
import { ShopService } from '../../services/ShopService';

const POLL_INTERVAL_MS = 5000;
const QUEUE_STATUSES: OrderStatus[] = [
  'PLACED',
  'PREPARING',
  'READY_FOR_PICKUP',
  'ASSIGNED',
  'OUT_FOR_DELIVERY',
];

export default function OrderQueueScreen({ route, navigation }: any) {
  const { token } = useAuth();
  const { socket } = useSocket();
  const [shopId, setShopId] = useState<string | undefined>(route?.params?.shopId);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actingOrderId, setActingOrderId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchOrders = useCallback(async (silent = false) => {
    if (!token) return;
    try {
      if (!silent) setError(null);

      let resolvedShopId = shopId;
      if (!resolvedShopId) {
        const myShop = await ShopService.getMyShop(token);
        resolvedShopId = myShop.id;
        setShopId(resolvedShopId);
      }

      const list = await ShopOrderService.getQueue(resolvedShopId, QUEUE_STATUSES, token);
      setOrders(list);
    } catch (e: any) {
      if (!silent) setError(e.message || 'Could not load orders');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, shopId]);

  useFocusEffect(
    useCallback(() => {
      fetchOrders();
      pollRef.current = setInterval(() => fetchOrders(true), POLL_INTERVAL_MS);
      return () => {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
      };
    }, [fetchOrders]),
  );

  // Realtime: refresh on any order:statusUpdate so the queue reflects new orders
  // and transitions without waiting for the 5s poll.
  useEffect(() => {
    if (!socket) return;
    const onAny = () => fetchOrders(true);
    socket.on('order:statusUpdate', onAny);
    return () => { socket.off('order:statusUpdate', onAny); };
  }, [socket, fetchOrders]);

  const handleAction = async (
    orderId: string,
    action: 'accept' | 'reject' | 'ready',
  ) => {
    if (!token) return;
    setActingOrderId(orderId);
    try {
      if (action === 'accept') await ShopOrderService.accept(orderId, token);
      else if (action === 'reject') await ShopOrderService.reject(orderId, token);
      else await ShopOrderService.markReady(orderId, token);
      await fetchOrders();
    } catch (e: any) {
      Alert.alert('Action failed', e.message || 'Unable to update order');
    } finally {
      setActingOrderId(null);
    }
  };

  const confirmReject = (order: Order) => {
    const isInitial = order.orderStatus === 'PLACED';
    const title = isInitial ? 'Reject order?' : 'Cancel order?';
    const body = isInitial
      ? 'The customer will be notified and a refund will be issued for paid orders.'
      : 'This order will be cancelled and the customer notified. Refunds are issued for paid orders.';
    const actionLabel = isInitial ? 'Reject' : 'Cancel Order';
    Alert.alert(
      title,
      body,
      [
        { text: 'Keep', style: 'cancel' },
        { text: actionLabel, style: 'destructive', onPress: () => handleAction(order.id, 'reject') },
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
        <TouchableOpacity style={styles.topBarIcon} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Order Queue</Text>
        <View style={styles.topBarIcon} />
      </View>

      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchOrders();
            }}
            tintColor={COLORS.primary}
          />
        }
      >
        {error && <Text style={styles.errorText}>{error}</Text>}

        {orders.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="checkmark-done-outline" size={48} color={COLORS.textSecondary} />
            <Text style={styles.emptyTitle}>No active orders</Text>
            <Text style={styles.emptySub}>New orders appear here automatically.</Text>
          </View>
        ) : (
          orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              busy={actingOrderId === order.id}
              onAccept={() => handleAction(order.id, 'accept')}
              onReject={() => confirmReject(order)}
              onMarkReady={() => handleAction(order.id, 'ready')}
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function OrderCard({
  order,
  busy,
  onAccept,
  onReject,
  onMarkReady,
}: {
  order: Order;
  busy: boolean;
  onAccept: () => void;
  onReject: () => void;
  onMarkReady: () => void;
}) {
  const total = order.items.reduce((sum, it) => sum + (it.quantity || 0), 0);
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <View style={styles.orderHeaderLine}>
            <Text style={styles.orderId}>#{order.id.slice(-6).toUpperCase()}</Text>
            {order.customerName && (
              <Text style={styles.customerName} numberOfLines={1}>
                {order.customerName}
              </Text>
            )}
          </View>
          <Text style={styles.orderMeta}>
            {total} item{total !== 1 ? 's' : ''} • ₱{order.totalAmount.toFixed(2)} • {order.paymentMethod}
          </Text>
          {order.deliveryPersonnelName && (
            <Text style={styles.riderLine}>
              <Ionicons name="bicycle-outline" size={12} color={COLORS.primary} />
              {'  '}Rider: <Text style={{ fontWeight: '600' }}>{order.deliveryPersonnelName}</Text>
            </Text>
          )}
        </View>
        <StatusBadge status={order.orderStatus} />
      </View>

      <View style={styles.itemsList}>
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
              {it.addOns && it.addOns.length > 0 && (
                <Text style={styles.itemMods}>+ {it.addOns.join(', ')}</Text>
              )}
            </View>
            <Text style={styles.itemPrice}>₱{it.totalPrice.toFixed(2)}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.deliveryLine} numberOfLines={1}>
        <Ionicons name="location-outline" size={12} color={COLORS.textSecondary} />{' '}
        {order.deliveryLocation}
      </Text>

      <View style={styles.actionRow}>
        {order.orderStatus === 'PLACED' && (
          <>
            <TouchableOpacity
              style={[styles.btn, styles.btnSecondary]}
              onPress={onReject}
              disabled={busy}
            >
              <Text style={styles.btnSecondaryText}>Reject</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.btnPrimary]}
              onPress={onAccept}
              disabled={busy}
            >
              {busy
                ? <ActivityIndicator color={COLORS.white} />
                : <Text style={styles.btnPrimaryText}>Accept</Text>}
            </TouchableOpacity>
          </>
        )}

        {order.orderStatus === 'PREPARING' && (
          <>
            <TouchableOpacity
              style={[styles.btn, styles.btnSecondary]}
              onPress={onReject}
              disabled={busy}
            >
              <Text style={styles.btnSecondaryText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.btnPrimary]}
              onPress={onMarkReady}
              disabled={busy}
            >
              {busy
                ? <ActivityIndicator color={COLORS.white} />
                : <Text style={styles.btnPrimaryText}>Ready for Pickup</Text>}
            </TouchableOpacity>
          </>
        )}

        {order.orderStatus === 'READY_FOR_PICKUP' && (
          <>
            <TouchableOpacity
              style={[styles.btn, styles.btnSecondary]}
              onPress={onReject}
              disabled={busy}
            >
              <Text style={styles.btnSecondaryText}>Cancel</Text>
            </TouchableOpacity>
            <View style={[styles.btn, styles.btnDisabled]}>
              <Text style={styles.btnDisabledText}>{readyCountdownLabel(order.readyAt)}</Text>
            </View>
          </>
        )}

        {(order.orderStatus === 'ASSIGNED' || order.orderStatus === 'OUT_FOR_DELIVERY') && (
          <View style={[styles.btn, styles.btnDisabled, { flex: 1 }]}>
            <Text style={styles.btnDisabledText}>
              {order.orderStatus === 'ASSIGNED'
                ? 'Rider is on the way to pick up'
                : 'Rider is delivering to customer'}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

function StatusBadge({ status }: { status: OrderStatus }) {
  const map: Record<OrderStatus, { bg: string; fg: string; label: string }> = {
    PLACED: { bg: '#FFF4D6', fg: '#7A5A00', label: 'New' },
    PREPARING: { bg: '#FCE4E6', fg: '#8A2C33', label: 'Preparing' },
    READY_FOR_PICKUP: { bg: '#E0F0FF', fg: '#0A66B5', label: 'Ready' },
    ASSIGNED: { bg: '#E8E8E8', fg: '#3A3A3A', label: 'Assigned' },
    OUT_FOR_DELIVERY: { bg: '#E8E8E8', fg: '#3A3A3A', label: 'Out' },
    DELIVERED: { bg: '#E6F4EA', fg: '#1E8E3E', label: 'Delivered' },
    CANCELLED: { bg: '#F5F5F5', fg: '#666', label: 'Cancelled' },
  };
  const s = map[status];
  return (
    <View style={[styles.badge, { backgroundColor: s.bg }]}>
      <Text style={[styles.badgeText, { color: s.fg }]}>{s.label}</Text>
    </View>
  );
}

const EXPIRY_MS = 10 * 60 * 1000;

function readyCountdownLabel(readyAt?: string): string {
  if (!readyAt) return 'Awaiting delivery rider';
  const msLeft = new Date(readyAt).getTime() + EXPIRY_MS - Date.now();
  if (msLeft <= 0) return 'Expiring…';
  const totalSec = Math.floor(msLeft / 1000);
  const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const ss = String(totalSec % 60).padStart(2, '0');
  return `Awaiting rider · ${mm}:${ss} left`;
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
  list: { padding: SIZES.screenPadding, paddingBottom: 40 },
  emptyState: { alignItems: 'center', paddingVertical: 64 },
  emptyTitle: { fontSize: SIZES.bodySize, fontWeight: '600', color: COLORS.text, marginTop: 12 },
  emptySub: { fontSize: SIZES.smallSize, color: COLORS.textSecondary, marginTop: 4 },
  errorText: { color: '#D93025', marginBottom: 12 },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  orderHeaderLine: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  orderId: { fontSize: SIZES.bodySize, fontWeight: '700', color: COLORS.text },
  customerName: { fontSize: SIZES.captionSize, color: COLORS.text, flex: 1 },
  orderMeta: { fontSize: SIZES.smallSize, color: COLORS.textSecondary, marginTop: 2 },
  riderLine: { fontSize: SIZES.smallSize, color: COLORS.text, marginTop: 4 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: SIZES.smallSize, fontWeight: '600' },
  itemsList: { marginBottom: 10, gap: 6 },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start' },
  itemQty: { width: 28, fontSize: SIZES.captionSize, fontWeight: '600', color: COLORS.text },
  itemName: { fontSize: SIZES.captionSize, color: COLORS.text },
  itemMods: { fontSize: SIZES.smallSize, color: COLORS.textSecondary, marginTop: 1 },
  itemPrice: { fontSize: SIZES.captionSize, color: COLORS.text },
  deliveryLine: { fontSize: SIZES.smallSize, color: COLORS.textSecondary, marginBottom: 12 },
  actionRow: { flexDirection: 'row', gap: 8 },
  btn: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  btnPrimary: { backgroundColor: COLORS.primary },
  btnPrimaryText: { color: COLORS.white, fontWeight: '600', fontSize: SIZES.captionSize },
  btnSecondary: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.primary },
  btnSecondaryText: { color: COLORS.primary, fontWeight: '600', fontSize: SIZES.captionSize },
  btnDisabled: { backgroundColor: COLORS.backgroundSecondary },
  btnDisabledText: { color: COLORS.textSecondary, fontWeight: '500', fontSize: SIZES.captionSize },
});
