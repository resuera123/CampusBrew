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
import { DeliveryService } from '../../services/DeliveryService';
import { Order } from '../../services/OrderService';

export default function DeliveryHistoryScreen({ navigation }: any) {
  const { token } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setError(null);
      const list = await DeliveryService.getDeliveryHistory(token);
      setOrders(list.slice().sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      ));
    } catch (e: any) {
      setError(e.message || 'Could not load delivery history');
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
        <Text style={styles.topBarTitle}>Delivery History</Text>
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
            <Ionicons name="bag-check-outline" size={48} color={COLORS.textSecondary} />
            <Text style={styles.emptyTitle}>No completed deliveries yet</Text>
            <Text style={styles.emptySub}>Your delivered orders will show up here.</Text>
          </View>
        ) : (
          orders.map((order) => {
            const itemCount = order.items.reduce((sum, it) => sum + (it.quantity || 0), 0);
            return (
              <View key={order.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.shopName}>{order.shopName ?? 'Shop'}</Text>
                  <Text style={styles.amount}>₱{order.totalAmount.toFixed(2)}</Text>
                </View>
                <Text style={styles.orderId}>#{order.id.slice(-6).toUpperCase()}</Text>
                <Text style={styles.meta}>
                  {formatDate(order.updatedAt)} · {itemCount} item{itemCount !== 1 ? 's' : ''} · {order.paymentMethod === 'COD' ? 'Cash' : 'GCash'}
                </Text>
                <View style={styles.deliveredPill}>
                  <Ionicons name="checkmark-circle" size={12} color="#1E8E3E" />
                  <Text style={styles.deliveredText}>Delivered</Text>
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
  shopName: { fontSize: SIZES.bodySize, fontWeight: '700', color: COLORS.text },
  amount: { fontSize: SIZES.bodySize, fontWeight: '700', color: COLORS.text },
  orderId: { fontSize: SIZES.smallSize, color: COLORS.textSecondary, marginTop: 2 },
  meta: { fontSize: SIZES.smallSize, color: COLORS.textSecondary, marginTop: 4 },
  deliveredPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: '#E6F4EA', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 4, marginTop: 8,
  },
  deliveredText: { color: '#1E8E3E', fontSize: SIZES.smallSize, fontWeight: '600' },
});
