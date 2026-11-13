import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, AppState } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { Order } from '../services/OrderService';
import { ShopOrderService } from '../services/ShopOrderService';
import { ShopService } from '../services/ShopService';
import { navigate } from '../navigation/navigationRef';
import { showAlert } from './AppAlert';
import { useConfirm } from './ConfirmDialog';

/**
 * Shop side (FR-3.4): a card that slides down over any shop screen when an order
 * comes in, with Decline / Accept. It shows the shop's oldest order still waiting
 * (PLACED), so an order that arrived while the app was in the background still
 * pops up when the shop comes back. Tapping the card opens the order's details and
 * hides the card for that order; accepting or declining anywhere else (e.g. the
 * Order Queue) removes it too.
 */
export default function NewOrderPopup() {
  const { token, user } = useAuth();
  const { socket } = useSocket();
  const insets = useSafeAreaInsets();
  const { confirm, dialog } = useConfirm();
  const isShop = user?.role === 'SHOP_OPERATOR';

  const [waiting, setWaiting] = useState<Order[]>([]);
  const [acting, setActing] = useState<'accept' | 'decline' | null>(null);
  const [, setTick] = useState(0); // re-renders the "just now / n min ago" label
  const shopIdRef = useRef<string | null>(null);
  const hidden = useRef(new Set<string>()); // orders the shop opened from the card
  const slide = useRef(new Animated.Value(0)).current;

  const refresh = useCallback(async () => {
    if (!token || !isShop) return;
    try {
      if (!shopIdRef.current) shopIdRef.current = (await ShopService.getMyShop(token)).id;
      const list = await ShopOrderService.getQueue(shopIdRef.current, ['PLACED'], token);
      setWaiting(
        list
          .filter((o) => !hidden.current.has(o.id))
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
      );
    } catch {
      // Not approved yet, offline, etc. The Order Queue still shows everything.
    }
  }, [token, isShop]);

  // A new order, or any change to one (accepted in the queue, cancelled, expired).
  useEffect(() => {
    if (!socket || !isShop) return;
    socket.on('order:statusUpdate', refresh);
    return () => socket.off('order:statusUpdate', refresh);
  }, [socket, isShop, refresh]);

  // On login and whenever the app comes back to the foreground.
  useEffect(() => {
    if (!isShop) {
      setWaiting([]);
      shopIdRef.current = null;
      hidden.current.clear();
      return;
    }
    refresh();
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') refresh(); });
    return () => sub.remove();
  }, [isShop, refresh]);

  const order = waiting[0];

  useEffect(() => {
    Animated.spring(slide, { toValue: order ? 1 : 0, useNativeDriver: true, friction: 8 }).start();
  }, [order?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!order) return;
    const t = setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, [order?.id]);

  if (!isShop || !order) return null;

  const accept = async () => {
    if (!token) return;
    setActing('accept');
    try {
      await ShopOrderService.accept(order.id, token);
      await refresh();
    } catch (e: any) {
      showAlert('Could not accept', e.message || 'Please try again.');
      refresh();
    } finally {
      setActing(null);
    }
  };

  const decline = async () => {
    if (!token) return;
    const ok = await confirm({
      title: 'Decline order?',
      message: order.paymentMethod === 'GCASH'
        ? 'The customer will be notified and their GCash payment refunded.'
        : 'The customer will be notified.',
      confirmLabel: 'Decline',
      cancelLabel: 'Keep',
      destructive: true,
      icon: 'close-circle-outline',
    });
    if (!ok) return;
    setActing('decline');
    try {
      await ShopOrderService.reject(order.id, token);
      await refresh();
    } catch (e: any) {
      showAlert('Could not decline', e.message || 'Please try again.');
      refresh();
    } finally {
      setActing(null);
    }
  };

  const openDetails = () => {
    hidden.current.add(order.id);
    setWaiting((list) => list.filter((o) => o.id !== order.id));
    navigate('ShopOrderDetail', { order });
  };

  const first = order.items[0];
  const title = first
    ? `${first.itemName} × ${first.quantity}${first.size ? ` · ${first.size}` : ''}`
    : 'New order';
  const more = order.items.length - 1;
  const payment = order.paymentMethod === 'GCASH'
    ? `GCash · paid · ₱${order.totalAmount.toFixed(2)}`
    : `Cash on delivery · ₱${order.totalAmount.toFixed(2)}`;

  return (
    <>
      <Animated.View
        pointerEvents="box-none"
        style={[
          styles.wrap,
          { top: insets.top + 8 },
          {
            opacity: slide,
            transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [-160, 0] }) }],
          },
        ]}
      >
        <View style={styles.card}>
          <TouchableOpacity activeOpacity={0.8} onPress={openDetails} disabled={!!acting}>
            <View style={styles.headRow}>
              <Text style={styles.label}>NEW ORDER</Text>
              <Text style={styles.time}>
                {waiting.length > 1 ? `${waiting.length} waiting · ` : ''}{timeAgo(order.createdAt)}
              </Text>
            </View>
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
            {more > 0 && <Text style={styles.more}>+ {more} more item{more > 1 ? 's' : ''}</Text>}
            <Text style={styles.sub} numberOfLines={1}>{payment}</Text>
          </TouchableOpacity>

          <View style={styles.actions}>
            <TouchableOpacity style={[styles.btn, styles.decline]} onPress={decline} disabled={!!acting} activeOpacity={0.85}>
              {acting === 'decline'
                ? <ActivityIndicator color={COLORS.text} />
                : <Text style={styles.declineText}>Decline</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.accept]} onPress={accept} disabled={!!acting} activeOpacity={0.85}>
              {acting === 'accept'
                ? <ActivityIndicator color={COLORS.white} />
                : <Text style={styles.acceptText}>Accept</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
      {dialog}
    </>
  );
}

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (!Number.isFinite(mins) || mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  return `${Math.floor(mins / 60)} h ago`;
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 1000,
    elevation: 12,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    borderLeftWidth: 6,
    borderLeftColor: COLORS.primary,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  label: { color: COLORS.primary, fontWeight: '700', fontSize: 13, letterSpacing: 1.5 },
  time: { color: COLORS.textSecondary, fontSize: 13, fontStyle: 'italic' },
  title: { color: COLORS.text, fontWeight: '700', fontSize: 19 },
  more: { color: COLORS.textSecondary, fontSize: 13, marginTop: 1 },
  sub: { color: COLORS.textSecondary, fontSize: 14, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  btn: { height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  decline: { flex: 1, backgroundColor: COLORS.creamDark },
  accept: { flex: 1.9, backgroundColor: COLORS.primary },
  declineText: { color: COLORS.text, fontWeight: '600', fontSize: 16 },
  acceptText: { color: COLORS.white, fontWeight: '700', fontSize: 16 },
});
