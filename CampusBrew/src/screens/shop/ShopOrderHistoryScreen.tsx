import React, { useCallback, useState } from 'react';
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
import { ShopService } from '../../services/ShopService';
import { ShopOrderService } from '../../services/ShopOrderService';
import { Order, OrderStatus } from '../../services/OrderService';

const HISTORY_STATUSES: OrderStatus[] = ['DELIVERED', 'CANCELLED'];

export default function ShopOrderHistoryScreen({ navigation }: any) {
  const { token } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setError(null);
      const shop = await ShopService.getMyShop(token);
      const list = await ShopOrderService.getQueue(shop.id, HISTORY_STATUSES, token);
      setOrders(list.slice().sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      ));
    } catch (e: any) {
      setError(e.message || 'Could not load order history');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

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
        <Text style={styles.topBarTitle}>Order History</Text>
        <View style={styles.topBarIcon} />
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
        {error && <Text style={styles.errorText}>{error}</Text>}

        {orders.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="archive-outline" size={48} color={COLORS.textSecondary} />
            <Text style={styles.emptyTitle}>No past orders yet</Text>
            <Text style={styles.emptySub}>Delivered and cancelled orders will appear here.</Text>
          </View>
        ) : (
          orders.map((order) => {
            const itemCount = order.items.reduce((sum, it) => sum + (it.quantity || 0), 0);
            const isDelivered = order.orderStatus === 'DELIVERED';
            return (
              <View key={order.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.orderId}>#{order.id.slice(-6).toUpperCase()}</Text>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.amount}>₱{order.beverageSubtotal.toFixed(2)}</Text>
                    <Text style={styles.amountLabel}>shop revenue</Text>
                  </View>
                </View>
                {order.customerName && (
                  <Text style={styles.line}>{order.customerName}</Text>
                )}
                <Text style={styles.meta}>
                  {formatDate(order.updatedAt)} · {itemCount} item{itemCount !== 1 ? 's' : ''} · {order.paymentMethod === 'COD' ? 'Cash' : 'GCash'}
                </Text>
                {order.deliveryPersonnelName && (
                  <Text style={styles.line}>
                    <Ionicons name="bicycle-outline" size={12} color={COLORS.textSecondary} />
                    {'  '}{order.deliveryPersonnelName}
                  </Text>
                )}
                <View style={[styles.pill, isDelivered ? styles.pillDelivered : styles.pillCancelled]}>
                  <Text style={[styles.pillText, isDelivered ? styles.pillTextDelivered : styles.pillTextCancelled]}>
                    {isDelivered ? 'Delivered' : 'Cancelled'}
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString([], {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
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
  list: { padding: SIZES.screenPadding, paddingBottom: 32 },
  errorText: { color: '#D93025', marginBottom: 12 },
  emptyState: { alignItems: 'center', paddingVertical: 64 },
  emptyTitle: { fontSize: SIZES.bodySize, fontWeight: '600', color: COLORS.text, marginTop: 12 },
  emptySub: { fontSize: SIZES.smallSize, color: COLORS.textSecondary, marginTop: 4, textAlign: 'center' },
  card: { backgroundColor: COLORS.white, borderRadius: 12, padding: 14, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderId: { fontSize: SIZES.bodySize, fontWeight: '700', color: COLORS.text },
  amount: { fontSize: SIZES.bodySize, fontWeight: '700', color: COLORS.text },
  amountLabel: { fontSize: SIZES.tinySize, color: COLORS.textSecondary, marginTop: 1 },
  line: { fontSize: SIZES.captionSize, color: COLORS.text, marginTop: 4 },
  meta: { fontSize: SIZES.smallSize, color: COLORS.textSecondary, marginTop: 4 },
  pill: {
    alignSelf: 'flex-start',
    borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 4, marginTop: 8,
  },
  pillDelivered: { backgroundColor: '#E6F4EA' },
  pillCancelled: { backgroundColor: '#F5F5F5' },
  pillText: { fontSize: SIZES.smallSize, fontWeight: '600' },
  pillTextDelivered: { color: '#1E8E3E' },
  pillTextCancelled: { color: '#666' },
});
