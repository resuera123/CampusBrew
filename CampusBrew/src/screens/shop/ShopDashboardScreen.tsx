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
import { ShopService, Shop } from '../../services/ShopService';
import { ShopOrderService } from '../../services/ShopOrderService';

export default function ShopDashboardScreen({ navigation }: any) {
  const { token } = useAuth();
  const { socket } = useSocket();
  const [shop, setShop] = useState<Shop | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [preparingCount, setPreparingCount] = useState(0);
  const [readyCount, setReadyCount] = useState(0);
  const [totalSales, setTotalSales] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setError(null);
      const myShop = await ShopService.getMyShop(token);
      setShop(myShop);
      const [placed, preparing, ready, sales] = await Promise.all([
        ShopOrderService.getQueue(myShop.id, ['PLACED'], token),
        ShopOrderService.getQueue(myShop.id, ['PREPARING'], token),
        // "Ready" from the shop's POV = waiting for or being picked up by a rider.
        // Once the rider has the order in hand (OUT_FOR_DELIVERY) the shop is done with it.
        ShopOrderService.getQueue(myShop.id, ['READY_FOR_PICKUP', 'ASSIGNED'], token),
        ShopService.getMySalesTotal(token),
      ]);
      setPendingCount(placed.length);
      setPreparingCount(preparing.length);
      setReadyCount(ready.length);
      setTotalSales(sales.totalSales);
      setTotalOrders(sales.totalOrders);
    } catch (e: any) {
      setError(e.message || 'Could not load shop dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load();
      // Belt-and-suspenders poll. The socket listener below catches every event,
      // but if one is ever missed (reconnect blip, etc.) this guarantees we never
      // sit on stale Pending/Preparing/Ready counts for more than 10s.
      const interval = setInterval(load, 10_000);
      return () => clearInterval(interval);
    }, [load]),
  );

  // Realtime: refresh on any order event that could touch this shop's counts.
  useEffect(() => {
    if (!socket) return;
    const onAny = () => load();
    socket.on('order:statusUpdate', onAny);
    socket.on('order:assigned', onAny);
    socket.on('order:delivered', onAny);
    return () => {
      socket.off('order:statusUpdate', onAny);
      socket.off('order:assigned', onAny);
      socket.off('order:delivered', onAny);
    };
  }, [socket, load]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
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
        <View style={styles.header}>
          <Text style={styles.greeting}>Welcome back</Text>
          <Text style={styles.shopName}>{shop?.shopName ?? 'Your Shop'}</Text>
          <View style={[styles.statusPill, shop?.isOpen ? styles.statusOpen : styles.statusClosed]}>
            <View style={[styles.statusDot, shop?.isOpen ? styles.dotOpen : styles.dotClosed]} />
            <Text style={[styles.statusText, shop?.isOpen ? styles.statusTextOpen : styles.statusTextClosed]}>
              {shop?.isOpen ? 'Open' : 'Closed'}
            </Text>
          </View>
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}

        <View style={styles.salesCard}>
          <View style={styles.salesIconWrap}>
            <Ionicons name="trending-up-outline" size={22} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.salesLabel}>Total Sales</Text>
            <Text style={styles.salesValue}>₱{totalSales.toFixed(2)}</Text>
            <Text style={styles.salesSubtitle}>
              {totalOrders} order{totalOrders !== 1 ? 's' : ''} delivered · beverages only
            </Text>
          </View>
        </View>

        <View style={styles.statRow}>
          <StatCard
            label="Pending"
            value={pendingCount}
            color={COLORS.gold}
            onPress={() => navigation.navigate('OrderQueue', { shopId: shop?.id })}
          />
          <StatCard
            label="Preparing"
            value={preparingCount}
            color={COLORS.primaryLight}
            onPress={() => navigation.navigate('OrderQueue', { shopId: shop?.id })}
          />
          <StatCard
            label="Ready"
            value={readyCount}
            color={COLORS.primary}
            onPress={() => navigation.navigate('OrderQueue', { shopId: shop?.id })}
          />
        </View>

        <Text style={styles.sectionTitle}>Manage</Text>

        <ActionRow
          icon="receipt-outline"
          label="Order Queue"
          subtitle={`${pendingCount + preparingCount + readyCount} active`}
          onPress={() => navigation.navigate('OrderQueue', { shopId: shop?.id })}
        />
        <ActionRow
          icon="restaurant-outline"
          label="Menu Items"
          subtitle="Add, edit, or remove items"
          onPress={() => navigation.navigate('MenuManagement', { shopId: shop?.id })}
        />
        <ActionRow
          icon="toggle-outline"
          label="Item Availability"
          subtitle="Toggle items in/out of stock"
          onPress={() => navigation.navigate('ItemAvailability', { shopId: shop?.id })}
        />
        <ActionRow
          icon="archive-outline"
          label="Order History"
          subtitle="Past deliveries and cancellations"
          onPress={() => navigation.navigate('ShopOrderHistory')}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({
  label,
  value,
  color,
  onPress,
}: {
  label: string;
  value: number;
  color: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={[styles.statCard, { borderLeftColor: color }]} onPress={onPress}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function ActionRow({
  icon,
  label,
  subtitle,
  onPress,
}: {
  icon: any;
  label: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.actionRow} onPress={onPress}>
      <View style={styles.actionIconWrap}>
        <Ionicons name={icon} size={22} color={COLORS.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.actionLabel}>{label}</Text>
        <Text style={styles.actionSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.backgroundSecondary },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.backgroundSecondary },
  content: { padding: SIZES.screenPadding, paddingBottom: 32 },
  header: { marginBottom: 20 },
  greeting: { fontSize: SIZES.captionSize, color: COLORS.textSecondary },
  shopName: { fontSize: SIZES.titleSize, fontWeight: '700', color: COLORS.text, marginTop: 2 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
  },
  statusOpen: { backgroundColor: '#E6F4EA' },
  statusClosed: { backgroundColor: '#FCE8E8' },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  dotOpen: { backgroundColor: '#1E8E3E' },
  dotClosed: { backgroundColor: '#D93025' },
  statusText: { fontSize: SIZES.smallSize, fontWeight: '600' },
  statusTextOpen: { color: '#1E8E3E' },
  statusTextClosed: { color: '#D93025' },
  errorText: { color: '#D93025', marginBottom: 12 },
  salesCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.gold,
  },
  salesIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  salesLabel: { fontSize: SIZES.smallSize, color: COLORS.textSecondary, fontWeight: '600' },
  salesValue: { fontSize: 22, fontWeight: '700', color: COLORS.text, marginTop: 2 },
  salesSubtitle: { fontSize: SIZES.smallSize, color: COLORS.textSecondary, marginTop: 2 },
  statRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 4,
  },
  statValue: { fontSize: 24, fontWeight: '700', color: COLORS.text },
  statLabel: { fontSize: SIZES.smallSize, color: COLORS.textSecondary, marginTop: 2 },
  sectionTitle: {
    fontSize: SIZES.bodySize,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 10,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  actionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  actionLabel: { fontSize: SIZES.bodySize, fontWeight: '600', color: COLORS.text },
  actionSubtitle: { fontSize: SIZES.smallSize, color: COLORS.textSecondary, marginTop: 2 },
});
