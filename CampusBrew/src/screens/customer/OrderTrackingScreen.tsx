import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SIZES } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { OrderService, Order, OrderStatus, StatusHistoryEntry } from '../../services/OrderService';
import LiveMapView from '../../components/LiveMapView';
import RatingBadge from '../../components/RatingBadge';
import { showAlert } from '../../components/AppAlert';

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
  const [confirmInput, setConfirmInput] = useState(''); // v2.0 FR-4.2 — COD amount paid
  const [confirming, setConfirming] = useState(false);
  // v2.0 FR-3.4 — live dasher location
  const [dasherLoc, setDasherLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [etaSeconds, setEtaSeconds] = useState<number | null>(null);
  const [locDelayed, setLocDelayed] = useState(false);
  const lastLocAt = useRef<number>(0);

  // Mark the location "delayed" if no update arrives for 30s.
  useEffect(() => {
    if (order?.orderStatus !== 'OUT_FOR_DELIVERY') return;
    const t = setInterval(() => {
      if (lastLocAt.current && Date.now() - lastLocAt.current > 30_000) setLocDelayed(true);
    }, 5_000);
    return () => clearInterval(t);
  }, [order?.orderStatus]);

  // v2.0 FR-4.2 — customer confirms the cash they paid; a mismatch flags the payment.
  const handleConfirmPayment = async () => {
    if (!order || !token) return;
    const amount = parseFloat(confirmInput || String(order.totalAmount));
    if (isNaN(amount) || amount < 0) {
      showAlert('Enter the amount', 'Enter the cash amount you paid.');
      return;
    }
    setConfirming(true);
    try {
      const updated = await OrderService.confirmPayment(order.id, amount, token);
      setOrder(updated);
      if (updated.paymentStatus === 'FLAGGED') {
        showAlert('Amounts did not match',
          'The amount you confirmed differs from what the dasher recorded — this payment is flagged for review.');
      } else if (updated.paymentStatus === 'PAID_COD') {
        showAlert('Payment confirmed', 'Thanks! Your order is complete.');
      } else {
        showAlert('Confirmed', 'Waiting for the dasher to record the cash collected.');
      }
    } catch (e: any) {
      showAlert('Could not confirm', e.message || 'Please try again.');
    } finally {
      setConfirming(false);
    }
  };

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

  // v2.0 NFR-R3 — if a push or socket event is missed while backgrounded,
  // re-fetch the order whenever the app returns to the foreground.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') load();
    });
    return () => sub.remove();
  }, [load]);

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

    // v2.0 FR-3.4 — live dasher location for this order.
    const onLocation = (payload: { orderId: string; lat: number; lng: number; etaSeconds?: number }) => {
      if (payload.orderId !== orderId) return;
      setDasherLoc({ lat: payload.lat, lng: payload.lng });
      setEtaSeconds(payload.etaSeconds ?? null);
      lastLocAt.current = Date.now();
      setLocDelayed(false);
    };

    socket.on('order:statusUpdate', onStatusUpdate);
    socket.on('order:noDriver', onNoDriver);
    socket.on('location:update', onLocation);

    return () => {
      socket.off('order:statusUpdate', onStatusUpdate);
      socket.off('order:noDriver', onNoDriver);
      socket.off('location:update', onLocation);
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

        {/* v2.0 FR-3.2 step 7 / FR-2.1 — who's delivering, with their rating. */}
        {order.deliveryPersonnelName && !isCancelled && (
          <View style={styles.dasherCard}>
            <Ionicons name="bicycle" size={18} color={COLORS.primary} />
            <Text style={styles.dasherName} numberOfLines={1}>{order.deliveryPersonnelName}</Text>
            <RatingBadge average={order.deliveryPersonnelRating} />
            <Text style={styles.dasherLabel}>Dasher</Text>
          </View>
        )}

        {/* v2.0 FR-3.5 — chat with the shop until pickup, with the dasher once assigned. */}
        <View style={styles.chatRow}>
          <TouchableOpacity
            style={styles.chatBtn}
            onPress={() => navigation.navigate('Chat', { orderId: order.id, channel: 'SHOP' })}
          >
            <Ionicons name="storefront-outline" size={16} color={COLORS.primary} />
            <Text style={styles.chatBtnText}>Chat with Shop</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.chatBtn, !order.deliveryPersonnelId && styles.chatBtnDisabled]}
            disabled={!order.deliveryPersonnelId}
            onPress={() => navigation.navigate('Chat', { orderId: order.id, channel: 'DASHER' })}
          >
            <Ionicons name="bicycle-outline" size={16} color={COLORS.primary} />
            <Text style={styles.chatBtnText}>Chat with Dasher</Text>
          </TouchableOpacity>
        </View>

        {/* v2.0 FR-3.6 — rating prompt once delivered (the server enforces the 24h window). */}
        {order.orderStatus === 'DELIVERED' && (
          <TouchableOpacity
            style={styles.rateCard}
            onPress={() => navigation.navigate('RateOrder', { orderId: order.id })}
          >
            <Ionicons name="star" size={20} color={COLORS.gold} />
            <View style={{ flex: 1 }}>
              <Text style={styles.rateTitle}>Rate your order</Text>
              <Text style={styles.rateSub}>Tell us how the shop and your dasher did.</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>
        )}

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

            {order.orderStatus === 'OUT_FOR_DELIVERY' && (
              <LiveMapView
                lat={dasherLoc?.lat}
                lng={dasherLoc?.lng}
                etaSeconds={etaSeconds}
                delayed={locDelayed}
              />
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

        {order.paymentMethod === 'COD'
          && (order.orderStatus === 'OUT_FOR_DELIVERY' || order.orderStatus === 'DELIVERED')
          && order.customerConfirmedAmount == null && (
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Confirm your cash payment</Text>
            <Text style={styles.confirmHint}>
              Enter the amount you handed to the dasher (₱{order.totalAmount.toFixed(2)} total).
            </Text>
            <View style={styles.confirmRow}>
              <Text style={styles.confirmPeso}>₱</Text>
              <TextInput
                style={styles.confirmInput}
                value={confirmInput}
                onChangeText={setConfirmInput}
                keyboardType="decimal-pad"
                placeholder={order.totalAmount.toFixed(2)}
                placeholderTextColor={COLORS.textSecondary}
              />
            </View>
            <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirmPayment} disabled={confirming}>
              {confirming
                ? <ActivityIndicator color={COLORS.white} />
                : <Text style={styles.confirmBtnText}>Confirm Payment</Text>}
            </TouchableOpacity>
          </View>
        )}
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
    height: 64,
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
  summaryCard: { backgroundColor: COLORS.white, borderRadius: SIZES.cardRadius, padding: 16, marginBottom: 16, shadowColor: COLORS.espresso, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
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
  dasherCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.white, borderRadius: SIZES.cardRadius, padding: 14, marginBottom: 12,
  },
  dasherName: { flexShrink: 1, fontSize: SIZES.captionSize, fontWeight: '700', color: COLORS.text },
  dasherLabel: { marginLeft: 'auto', fontSize: SIZES.smallSize, color: COLORS.textSecondary },
  chatRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  chatBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 42, borderRadius: SIZES.buttonBorderRadius, borderWidth: 1, borderColor: COLORS.primary,
    backgroundColor: COLORS.white,
  },
  chatBtnDisabled: { opacity: 0.4 },
  chatBtnText: { color: COLORS.primary, fontSize: SIZES.captionSize, fontWeight: '600' },
  rateCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.white, borderRadius: 12, padding: 14, marginBottom: 16,
    borderWidth: 1, borderColor: COLORS.goldLight,
  },
  rateTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  rateSub: { fontSize: SIZES.smallSize, color: COLORS.textSecondary, marginTop: 2 },
  sectionTitle: { fontSize: SIZES.bodySize, fontWeight: '600', color: COLORS.text, marginBottom: 10, marginTop: 6 },
  timelineCard: { backgroundColor: COLORS.white, borderRadius: SIZES.cardRadius, padding: 16, marginBottom: 16 },
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
  itemsCard: { backgroundColor: COLORS.white, borderRadius: SIZES.cardRadius, padding: 16, marginBottom: 16 },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 6 },
  itemQty: { width: 28, fontSize: SIZES.captionSize, fontWeight: '600', color: COLORS.text },
  itemName: { fontSize: SIZES.captionSize, color: COLORS.text },
  itemMods: { fontSize: SIZES.smallSize, color: COLORS.textSecondary, marginTop: 1 },
  itemPrice: { fontSize: SIZES.captionSize, color: COLORS.text },
  metaCard: { backgroundColor: COLORS.white, borderRadius: SIZES.cardRadius, padding: 16 },
  confirmCard: { backgroundColor: COLORS.white, borderRadius: SIZES.cardRadius, padding: 16, marginTop: 16 },
  confirmTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  confirmHint: { fontSize: 12.5, color: COLORS.textSecondary, marginTop: 4, marginBottom: 12 },
  confirmRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 12, marginBottom: 12 },
  confirmPeso: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginRight: 4 },
  confirmInput: { flex: 1, fontSize: 16, color: COLORS.text, paddingVertical: 12 },
  confirmBtn: { height: SIZES.buttonHeight, backgroundColor: COLORS.primary, borderRadius: SIZES.buttonBorderRadius, justifyContent: 'center', alignItems: 'center' },
  confirmBtnText: { color: COLORS.white, fontSize: 15, fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  metaText: { flex: 1, fontSize: SIZES.captionSize, color: COLORS.text },
});
