import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { OrderService, Order, OrderStatus } from '../../services/OrderService';

function formatDate(iso?: string) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function OrderHistoryScreen({ navigation }: any) {
  const { token } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reorderingId, setReorderingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) {
      setError('Please log in to view your orders.');
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const page = await OrderService.getHistory(token, 0);
      // Belt-and-suspenders: backend already sorts by createdAt DESC, but force it
      // client-side too so the newest order is guaranteed to be on top.
      const list = (page.content || []).slice().sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      setOrders(list);
    } catch (e: any) {
      setError(e.message || 'Could not load orders');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const handleReorder = async (orderId: string) => {
    if (!token) return;
    setReorderingId(orderId);
    try {
      const payload = await OrderService.reorder(orderId, token);
      navigation.navigate('ReorderCart', { payload });
    } catch (e: any) {
      Alert.alert('Could not reorder', e.message || 'Try again.');
    } finally {
      setReorderingId(null);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      <View style={styles.topBar}>
        <View style={styles.topBarIcon} />
        <Text style={styles.topBarTitle}>Order History</Text>
        <View style={styles.topBarIcon} />
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        >
          {error ? (
            <View style={styles.emptyBlock}>
              <Text style={styles.emptyText}>{error}</Text>
              <TouchableOpacity onPress={load} style={styles.retryBtn}>
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : orders.length === 0 ? (
            <View style={styles.emptyBlock}>
              <Ionicons name="receipt-outline" size={32} color={COLORS.textSecondary} />
              <Text style={styles.emptyText}>No past orders yet</Text>
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              {orders.map((order) => {
                const itemSummary = order.items.map((i) => i.itemName).join(', ');
                const isReordering = reorderingId === order.id;
                return (
                  <TouchableOpacity
                    key={order.id}
                    style={styles.orderCard}
                    activeOpacity={0.85}
                    onPress={() => navigation.navigate('OrderTracking', { orderId: order.id })}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={styles.orderDate}>{formatDate(order.createdAt)}</Text>
                      <Text style={styles.orderTotal}>₱{order.totalAmount.toFixed(0)}</Text>
                    </View>
                    <Text style={styles.orderShop}>{order.shopName || 'Shop'}</Text>
                    <Text style={styles.orderItems} numberOfLines={2}>{itemSummary}</Text>
                    <View style={styles.badgeRow}>
                      <StatusBadge status={order.orderStatus} />
                    </View>
                    <TouchableOpacity
                      style={styles.reorderBtn}
                      onPress={() => handleReorder(order.id)}
                      disabled={isReordering}
                      activeOpacity={0.85}
                    >
                      {isReordering ? (
                        <ActivityIndicator color={COLORS.primary} size="small" />
                      ) : (
                        <Text style={styles.reorderText}>Reorder</Text>
                      )}
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function StatusBadge({ status }: { status: OrderStatus }) {
  const map: Record<OrderStatus, { bg: string; fg: string; label: string }> = {
    PLACED:           { bg: '#FFF4D6', fg: '#7A5A00', label: 'Placed' },
    PREPARING:        { bg: '#FCE4E6', fg: '#8A2C33', label: 'Preparing' },
    READY_FOR_PICKUP: { bg: '#E0F0FF', fg: '#0A66B5', label: 'Ready' },
    ASSIGNED:         { bg: '#E0F0FF', fg: '#0A66B5', label: 'Rider assigned' },
    OUT_FOR_DELIVERY: { bg: '#E0F0FF', fg: '#0A66B5', label: 'On the way' },
    DELIVERED:        { bg: '#E6F4EA', fg: '#1E8E3E', label: 'Completed' },
    CANCELLED:        { bg: '#FCE8E8', fg: '#D93025', label: 'Cancelled' },
  };
  const s = map[status] ?? { bg: '#F5F5F5', fg: '#666', label: status };
  return (
    <View style={[styles.statusPill, { backgroundColor: s.bg }]}>
      <Text style={[styles.statusPillText, { color: s.fg }]}>{s.label}</Text>
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
  topBarIcon: { width: 40, height: 40 },
  topBarTitle: { flex: 1, fontSize: 16, fontWeight: '600', color: COLORS.text, textAlign: 'center' },

  content: { flex: 1 },
  contentContainer: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32 },

  orderCard: { backgroundColor: COLORS.background, borderRadius: 12, padding: 14, gap: 4 },
  orderDate: { fontSize: 12, color: COLORS.textSecondary },
  orderTotal: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  orderShop: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginTop: 2 },
  orderItems: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },

  reorderBtn: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: SIZES.buttonBorderRadius,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reorderText: { color: COLORS.primary, fontWeight: '600' },
  badgeRow: { flexDirection: 'row', marginTop: 8 },
  statusPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusPillText: { fontSize: SIZES.smallSize, fontWeight: '700' },

  emptyBlock: { paddingVertical: 48, alignItems: 'center', gap: 12 },
  emptyText: { color: COLORS.textSecondary, fontSize: 14 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 8, borderWidth: 1, borderColor: COLORS.primary, borderRadius: 18 },
  retryText: { color: COLORS.primary, fontWeight: '600' },
});
