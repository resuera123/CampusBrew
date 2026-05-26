import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  PanResponder,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SIZES } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { OrderService, Order, OrderStatus, StatusHistoryEntry } from '../../services/OrderService';

const TERMINAL: OrderStatus[] = ['DELIVERED', 'CANCELLED'];
const COLLAPSED_HEIGHT = 110;
const EXPANDED_HEIGHT = Math.min(Math.round(Dimensions.get('window').height * 0.65), 560);
const DRAG_RANGE = EXPANDED_HEIGHT - COLLAPSED_HEIGHT;

const STATUS_BLURBS: Record<OrderStatus, { label: string; tone: 'info' | 'progress' | 'done' }> = {
  PLACED:           { label: 'Order placed',         tone: 'info' },
  PREPARING:        { label: 'Shop is preparing it', tone: 'progress' },
  READY_FOR_PICKUP: { label: 'Waiting for a rider',  tone: 'progress' },
  ASSIGNED:         { label: 'Rider is picking up',  tone: 'progress' },
  OUT_FOR_DELIVERY: { label: 'On the way to you',    tone: 'progress' },
  DELIVERED:        { label: 'Delivered',            tone: 'done' },
  CANCELLED:        { label: 'Cancelled',            tone: 'done' },
};

const TIMELINE_STEPS: { status: OrderStatus; label: string }[] = [
  { status: 'PLACED',           label: 'Order Placed' },
  { status: 'PREPARING',        label: 'Preparing' },
  { status: 'READY_FOR_PICKUP', label: 'Ready for Pickup' },
  { status: 'ASSIGNED',         label: 'Rider Assigned' },
  { status: 'OUT_FOR_DELIVERY', label: 'Out for Delivery' },
  { status: 'DELIVERED',        label: 'Delivered' },
];

/**
 * Sticky bottom banner showing the customer's current in-flight order.
 * Drag up (or tap the chevron) to expand into a peek view with the full
 * status timeline. Tap anywhere on the collapsed pill to jump to the full
 * OrderTracking screen.
 */
export default function CurrentOrderBanner({ navigation }: { navigation: any }) {
  const { token } = useAuth();
  const { socket } = useSocket();
  const [order, setOrder] = useState<Order | null>(null);
  const [expanded, setExpanded] = useState(false);

  // 0 = collapsed, DRAG_RANGE = fully expanded. Animated for gesture + spring snap.
  const dragValue = useRef(new Animated.Value(0)).current;
  const dragOffset = useRef(0);

  const snapTo = useCallback((target: 0 | typeof DRAG_RANGE) => {
    setExpanded(target === DRAG_RANGE);
    Animated.spring(dragValue, {
      toValue: target,
      useNativeDriver: false,
      bounciness: 4,
      speed: 16,
    }).start(() => { dragOffset.current = target; });
  }, [dragValue]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 4,
      onPanResponderGrant: () => {
        dragValue.stopAnimation((value) => { dragOffset.current = value; });
      },
      onPanResponderMove: (_, gesture) => {
        // Negative dy = drag up = expanding. We track "how much above collapsed".
        const next = Math.max(0, Math.min(DRAG_RANGE, dragOffset.current - gesture.dy));
        dragValue.setValue(next);
      },
      onPanResponderRelease: (_, gesture) => {
        dragValue.stopAnimation((current) => {
          // Snap by velocity if the flick is decisive, otherwise by position.
          const goingUp = gesture.vy < -0.5 || (Math.abs(gesture.vy) < 0.5 && current > DRAG_RANGE / 2);
          snapTo(goingUp ? DRAG_RANGE : 0);
        });
      },
      onPanResponderTerminate: () => {
        dragValue.stopAnimation((current) => {
          snapTo(current > DRAG_RANGE / 2 ? DRAG_RANGE : 0);
        });
      },
    }),
  ).current;

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const page = await OrderService.getHistory(token, 0);
      const active = page.content.find((o) => !TERMINAL.includes(o.orderStatus));
      setOrder(active ?? null);
      if (!active) snapTo(0); // collapse if no active order
    } catch {
      // Silently fail — banner just stays hidden if we can't fetch.
    }
  }, [token, snapTo]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    if (!socket) return;
    const onStatusUpdate = () => load();
    socket.on('order:statusUpdate', onStatusUpdate);
    return () => { socket.off('order:statusUpdate', onStatusUpdate); };
  }, [socket, load]);

  if (!order) return null;

  const blurb = STATUS_BLURBS[order.orderStatus] ?? { label: order.orderStatus, tone: 'info' };
  const itemCount = order.items.reduce((sum, i) => sum + (i.quantity || 0), 0);
  const reached = mapStatusHistory(order.statusHistory ?? []);

  const animatedHeight = dragValue.interpolate({
    inputRange: [0, DRAG_RANGE],
    outputRange: [COLLAPSED_HEIGHT, EXPANDED_HEIGHT],
    extrapolate: 'clamp',
  });

  const expandedOpacity = dragValue.interpolate({
    inputRange: [0, DRAG_RANGE * 0.4, DRAG_RANGE],
    outputRange: [0, 0, 1],
    extrapolate: 'clamp',
  });

  const handleHeaderTap = () => {
    if (expanded) {
      // When expanded, header tap → go to full tracking screen.
      navigation.navigate('OrderTracking', { orderId: order.id });
    } else {
      // Collapsed → tap header expands. (Chevron also toggles via the same handler.)
      snapTo(DRAG_RANGE);
    }
  };

  const toggleArrow = () => snapTo(expanded ? 0 : DRAG_RANGE);

  return (
    <Animated.View style={[styles.container, { height: animatedHeight }]}>
      <View {...panResponder.panHandlers}>
        <View style={styles.dragHandle} />

        <TouchableOpacity activeOpacity={0.85} onPress={handleHeaderTap}>
          <View style={styles.row}>
            <View style={styles.iconWrap}>
              <Ionicons name="bicycle-outline" size={20} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title} numberOfLines={1}>
                {order.shopName ?? 'Your order'} · #{order.id.slice(-6).toUpperCase()}
              </Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                {blurb.label} · {itemCount} item{itemCount !== 1 ? 's' : ''} · ₱{order.totalAmount.toFixed(2)}
              </Text>
            </View>
            <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={toggleArrow}>
              <Ionicons
                name={expanded ? 'chevron-down' : 'chevron-up'}
                size={22}
                color={COLORS.textSecondary}
              />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </View>

      <Animated.View style={[styles.expandedBody, { opacity: expandedOpacity }]} pointerEvents={expanded ? 'auto' : 'none'}>
        <Text style={styles.sectionTitle}>Status</Text>
        {TIMELINE_STEPS.map((step, i) => {
          const ts = reached.get(step.status);
          const isCurrent = order.orderStatus === step.status;
          return (
            <TimelineRow
              key={step.status}
              label={step.label}
              timestamp={ts}
              reached={!!ts}
              current={isCurrent}
              last={i === TIMELINE_STEPS.length - 1}
            />
          );
        })}

        <TouchableOpacity
          style={styles.openBtn}
          onPress={() => navigation.navigate('OrderTracking', { orderId: order.id })}
          activeOpacity={0.85}
        >
          <Text style={styles.openBtnText}>Open full tracking</Text>
          <Ionicons name="arrow-forward" size={16} color={COLORS.white} />
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

function TimelineRow({
  label, timestamp, reached, current, last,
}: { label: string; timestamp?: string; reached: boolean; current: boolean; last: boolean }) {
  return (
    <View style={styles.timelineRow}>
      <View style={styles.timelineGutter}>
        <View style={[
          styles.dot,
          reached && styles.dotReached,
          current && styles.dotCurrent,
        ]}>
          {reached && <Ionicons name="checkmark" size={10} color={COLORS.white} />}
        </View>
        {!last && <View style={[styles.line, reached && styles.lineReached]} />}
      </View>
      <View style={styles.timelineBody}>
        <Text style={[styles.timelineLabel, reached && styles.timelineLabelReached]}>{label}</Text>
        {reached && timestamp ? <Text style={styles.timelineTimestamp}>{formatTime(timestamp)}</Text> : null}
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
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    backgroundColor: COLORS.white,
    borderRadius: 14,
    paddingTop: 6,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -2 },
    elevation: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  dragHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: 'center', marginBottom: 8,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 12 },
  iconWrap: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.backgroundSecondary,
    justifyContent: 'center', alignItems: 'center',
  },
  title: { fontSize: SIZES.captionSize, fontWeight: '700', color: COLORS.text },
  subtitle: { fontSize: SIZES.smallSize, color: COLORS.textSecondary, marginTop: 2 },

  expandedBody: {
    paddingTop: 4,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: SIZES.captionSize,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 12,
    marginBottom: 8,
  },

  timelineRow: { flexDirection: 'row', alignItems: 'flex-start' },
  timelineGutter: { width: 22, alignItems: 'center' },
  dot: {
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: COLORS.backgroundSecondary,
    borderWidth: 2, borderColor: COLORS.border,
    justifyContent: 'center', alignItems: 'center',
    marginTop: 1,
  },
  dotReached: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  dotCurrent: { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
  line: {
    width: 2, flex: 1, backgroundColor: COLORS.border,
    minHeight: 20, alignSelf: 'center',
  },
  lineReached: { backgroundColor: COLORS.primary },
  timelineBody: { flex: 1, paddingLeft: 8, paddingBottom: 10 },
  timelineLabel: { fontSize: SIZES.smallSize, color: COLORS.textSecondary },
  timelineLabelReached: { color: COLORS.text, fontWeight: '600' },
  timelineTimestamp: { fontSize: SIZES.tinySize, color: COLORS.textSecondary, marginTop: 1 },

  openBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
    height: 40,
    backgroundColor: COLORS.primary,
    borderRadius: 20,
  },
  openBtnText: { color: COLORS.white, fontWeight: '700', fontSize: SIZES.captionSize },
});
