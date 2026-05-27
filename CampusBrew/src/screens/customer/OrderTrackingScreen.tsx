import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SIZES } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { OrderService, Order, OrderStatus, StatusHistoryEntry } from '../../services/OrderService';

const TIMELINE_STEPS: { status: OrderStatus; label: string; description: string }[] = [
  { status: 'PLACED', label: 'Order Placed', description: 'Your order has been sent to the shop.' },
  { status: 'PREPARING', label: 'Preparing', description: 'The shop is preparing your order.' },
  { status: 'READY_FOR_PICKUP', label: 'Ready for Pickup', description: 'Waiting for a rider.' },
  { status: 'ASSIGNED', label: 'Rider Assigned', description: 'A rider is heading to the shop.' },
  { status: 'OUT_FOR_DELIVERY', label: 'Out for Delivery', description: 'On the way to you.' },
  { status: 'DELIVERED', label: 'Delivered', description: 'Enjoy!' },
];

interface StatusUpdatePayload {
  orderId: string;
  status: OrderStatus;
  paymentStatus?: string;
  timestamp?: string;
}

export default function OrderTrackingScreen({ route, navigation }: any) {
  const { token } = useAuth();
  const { socket } = useSocket();
  const orderId: string = route?.params?.orderId;
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noDriver, setNoDriver] = useState(false);

  const load = useCallback(async () => {
    if (!token || !orderId) return;
    try {
      setError(null);
      const o = await OrderService.getOrderById(orderId, token);
      setOrder(o);
    } catch (e: any) {
      setError(e.message || 'Could not load order');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, orderId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Live updates: refetch when statusUpdate or noDriver events fire for this order.
  useEffect(() => {
    if (!socket || !orderId) return;

    const onStatusUpdate = (payload: StatusUpdatePayload) => {
      if (payload.orderId !== orderId) return;
      // Patch the local state immediately so the timeline ticks live, then
      // refetch for canonical truth (delivery personnel name, etc.).
      setOrder((prev) => {
        if (!prev) return prev;
        const ts = payload.timestamp ?? new Date().toISOString();
        const history = prev.statusHistory ?? [];
        const alreadyHas = history.some((h) => h.status === payload.status);
        return {
          ...prev,
          orderStatus: payload.status,
          paymentStatus: (payload.paymentStatus as Order['paymentStatus']) ?? prev.paymentStatus,
          statusHistory: alreadyHas
            ? history
            : [...history, { status: payload.status, timestamp: ts }],
        };
      });
      load();
    };

    const onNoDriver = (payload: { orderId: string }) => {
      if (payload.orderId === orderId) setNoDriver(true);
    };

    socket.on('order:statusUpdate', onStatusUpdate);
    socket.on('order:noDriver', onNoDriver);

    return () => {
      socket.off('order:statusUpdate', onStatusUpdate);
      socket.off('order:noDriver', onNoDriver);
    };
  }, [socket, orderId, load]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Header navigation={navigation} />
        <View style={styles.emptyState}>
          <Text style={styles.errorText}>{error || 'Order not found.'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const reachedStatusMap = mapStatusHistory(order.statusHistory ?? []);
  const isCancelled = order.orderStatus === 'CANCELLED';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header navigation={navigation} />

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
        <View style={styles.summaryCard}>
          <Text style={styles.orderIdLabel}>Order ID</Text>
          <Text style={styles.orderIdValue}>#{order.id.slice(-6).toUpperCase()}</Text>
          {order.shopName && <Text style={styles.shopName}>{order.shopName}</Text>}
          <Text style={styles.totalText}>
            {order.items.length} item{order.items.length !== 1 ? 's' : ''} · ₱{order.totalAmount.toFixed(2)}
          </Text>
        </View>

        {isCancelled ? (
          <View style={styles.cancelledBanner}>
            <Ionicons name="close-circle" size={22} color="#D93025" />
            <Text style={styles.cancelledText}>
              This order was cancelled.
              {order.paymentStatus === 'REFUND_PENDING' ? ' Refund is pending.' : ''}
            </Text>
          </View>
        ) : (
          <>
            {noDriver && (
              <View style={styles.warnBanner}>
                <Ionicons name="alert-circle-outline" size={20} color="#7A5A00" />
                <Text style={styles.warnText}>
                  No riders available yet. We're still looking.
                </Text>
              </View>
            )}

            <Text style={styles.sectionTitle}>Order Status</Text>
            <View style={styles.timelineCard}>
              {TIMELINE_STEPS.map((step, i) => {
                const ts = reachedStatusMap.get(step.status);
                const reached = !!ts;
                const isCurrent = order.orderStatus === step.status;
                return (
                  <TimelineRow
                    key={step.status}
                    label={step.label}
                    description={step.description}
                    timestamp={ts}
                    reached={reached}
                    current={isCurrent}
                    last={i === TIMELINE_STEPS.length - 1}
                  />
                );
              })}
            </View>
          </>
        )}

        <Text style={styles.sectionTitle}>Items</Text>
        <View style={styles.itemsCard}>
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
              <Text style={styles.itemPrice}>₱{it.totalPrice.toFixed(2)}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Delivery</Text>
        <View style={styles.metaCard}>
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={16} color={COLORS.primary} />
            <Text style={styles.metaText}>{order.deliveryLocation}</Text>
          </View>
          <View style={styles.metaRow}>
            <Ionicons name="card-outline" size={16} color={COLORS.primary} />
            <Text style={styles.metaText}>
              {order.paymentMethod === 'COD' ? 'Cash on Delivery' : 'GCash'}
              {order.paymentStatus ? ` · ${formatPaymentStatus(order.paymentStatus)}` : ''}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Header({ navigation }: { navigation: any }) {
  return (
    <View style={styles.topBar}>
      <TouchableOpacity style={styles.topBarIcon} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={22} color={COLORS.text} />
      </TouchableOpacity>
      <Text style={styles.topBarTitle}>Order Tracking</Text>
      <View style={styles.topBarIcon} />
    </View>
  );
}

function TimelineRow({
  label,
  description,
  timestamp,
  reached,
  current,
  last,
}: {
  label: string;
  description: string;
  timestamp?: string;
  reached: boolean;
  current: boolean;
  last: boolean;
}) {
  return (
    <View style={styles.timelineRow}>
      <View style={styles.timelineGutter}>
        <View style={[
          styles.dot,
          reached && styles.dotReached,
          current && styles.dotCurrent,
        ]}>
          {reached && <Ionicons name="checkmark" size={12} color={COLORS.white} />}
        </View>
        {!last && <View style={[styles.line, reached && styles.lineReached]} />}
      </View>
      <View style={styles.timelineBody}>
        <Text style={[styles.timelineLabel, reached && styles.timelineLabelReached]}>
          {label}
        </Text>
        {reached && timestamp && (
          <Text style={styles.timelineTimestamp}>{formatTime(timestamp)}</Text>
        )}
        {!reached && (
          <Text style={styles.timelineDescription}>{description}</Text>
        )}
      </View>
    </View>
  );
}

function mapStatusHistory(history: StatusHistoryEntry[]): Map<OrderStatus, string> {
  const m = new Map<OrderStatus, string>();
  for (const entry of history) {
    if (!m.has(entry.status)) m.set(entry.status, entry.timestamp);
  }
  return m;
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

function formatPaymentStatus(s: string): string {
  return s.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
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
  emptyState: { padding: SIZES.screenPadding, alignItems: 'center' },
  errorText: { color: '#D93025', textAlign: 'center' },
  content: { padding: SIZES.screenPadding, paddingBottom: 32 },
  summaryCard: { backgroundColor: COLORS.white, borderRadius: 12, padding: 14, marginBottom: 16 },
  orderIdLabel: { fontSize: SIZES.smallSize, color: COLORS.textSecondary },
  orderIdValue: { fontSize: SIZES.titleSize, fontWeight: '700', color: COLORS.text },
  shopName: { fontSize: SIZES.captionSize, color: COLORS.text, marginTop: 2 },
  totalText: { fontSize: SIZES.smallSize, color: COLORS.textSecondary, marginTop: 4 },
  cancelledBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FCE8E8', borderRadius: 8, padding: 12, marginBottom: 12,
  },
  cancelledText: { color: '#D93025', flex: 1, fontSize: SIZES.captionSize },
  warnBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFF4D6', borderRadius: 8, padding: 12, marginBottom: 12,
  },
  warnText: { color: '#7A5A00', flex: 1, fontSize: SIZES.captionSize },
  sectionTitle: { fontSize: SIZES.bodySize, fontWeight: '600', color: COLORS.text, marginBottom: 10, marginTop: 6 },
  timelineCard: { backgroundColor: COLORS.white, borderRadius: 12, padding: 14, marginBottom: 16 },
  timelineRow: { flexDirection: 'row', alignItems: 'flex-start' },
  timelineGutter: { width: 28, alignItems: 'center' },
  dot: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: COLORS.backgroundSecondary,
    borderWidth: 2, borderColor: COLORS.border,
    justifyContent: 'center', alignItems: 'center',
    marginTop: 2,
  },
  dotReached: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  dotCurrent: { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
  line: {
    width: 2,
    flex: 1,
    backgroundColor: COLORS.border,
    minHeight: 28,
    alignSelf: 'center',
  },
  lineReached: { backgroundColor: COLORS.primary },
  timelineBody: { flex: 1, paddingLeft: 10, paddingBottom: 18 },
  timelineLabel: { fontSize: SIZES.captionSize, fontWeight: '500', color: COLORS.textSecondary },
  timelineLabelReached: { color: COLORS.text, fontWeight: '600' },
  timelineTimestamp: { fontSize: SIZES.smallSize, color: COLORS.textSecondary, marginTop: 2 },
  timelineDescription: { fontSize: SIZES.smallSize, color: COLORS.textSecondary, marginTop: 2 },
  itemsCard: { backgroundColor: COLORS.white, borderRadius: 12, padding: 14, marginBottom: 16 },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 6 },
  itemQty: { width: 28, fontSize: SIZES.captionSize, fontWeight: '600', color: COLORS.text },
  itemName: { fontSize: SIZES.captionSize, color: COLORS.text },
  itemMods: { fontSize: SIZES.smallSize, color: COLORS.textSecondary, marginTop: 1 },
  itemPrice: { fontSize: SIZES.captionSize, color: COLORS.text },
  metaCard: { backgroundColor: COLORS.white, borderRadius: 12, padding: 14 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  metaText: { flex: 1, fontSize: SIZES.captionSize, color: COLORS.text },
});
