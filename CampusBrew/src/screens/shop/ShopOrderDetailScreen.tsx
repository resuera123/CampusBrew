import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { Order } from '../../services/OrderService';
import { PaymentCenterService } from '../../services/PaymentCenterService';
import ReportProblemCard from '../../components/ReportProblemCard';

const PAYMENT_STATUS: Record<string, string> = {
  PAID_GCASH: 'Paid (GCash)',
  PAID_COD: 'Paid (cash)',
  PENDING_COD: 'Cash on delivery',
  REFUNDED: 'Refunded',
  REFUND_PENDING: 'Refund pending',
};

/** One past order for the shop: items, money, who was involved, and Report a Problem. */
export default function ShopOrderDetailScreen({ route, navigation }: any) {
  const order: Order = route?.params?.order;
  const { token } = useAuth();
  const [reported, setReported] = useState(false);

  useEffect(() => {
    if (!token || !order?.id) return;
    PaymentCenterService.orderReported(order.id, token).then(setReported).catch(() => {});
  }, [token, order?.id]);

  if (!order) return null;
  const delivered = order.orderStatus === 'DELIVERED';
  const cod = order.paymentMethod === 'COD';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.topBarIcon} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Order #{order.id.slice(-6).toUpperCase()}</Text>
        <View style={styles.topBarIcon} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headRow}>
          <Text style={styles.date}>{formatDate(order.updatedAt)}</Text>
          <View style={[styles.pill, delivered ? styles.pillDelivered : styles.pillCancelled]}>
            <Text style={[styles.pillText, delivered ? styles.pillTextDelivered : styles.pillTextCancelled]}>
              {delivered ? 'Delivered' : 'Cancelled'}
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Items</Text>
          {order.items.map((it, i) => {
            const options = [it.size, it.sugarLevel, it.temperature, ...(it.addOns ?? [])].filter(Boolean).join(' • ');
            return (
              <View key={i} style={styles.itemRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{it.quantity}× {it.itemName}</Text>
                  {!!options && <Text style={styles.itemOptions}>{options}</Text>}
                </View>
                <Text style={styles.itemPrice}>₱{(it.totalPrice ?? it.unitPrice * it.quantity).toFixed(2)}</Text>
              </View>
            );
          })}
          <View style={styles.divider} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Shop revenue (drinks)</Text>
            <Text style={styles.totalValue}>₱{order.beverageSubtotal.toFixed(2)}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Payment</Text>
          <Detail icon={cod ? 'cash-outline' : 'phone-portrait-outline'} label="Method" value={cod ? 'Cash on delivery' : 'GCash'} />
          <Detail
            icon="pulse-outline"
            label="Status"
            value={PAYMENT_STATUS[order.paymentStatus] ?? order.paymentStatus}
          />
          {cod && order.shopPaymentConfirmedAt && (
            <Detail icon="checkmark-done-outline" label="Cash received from dasher" value={formatDate(order.shopPaymentConfirmedAt)} />
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>People</Text>
          <Detail icon="person-outline" label="Customer" value={order.customerName ?? '—'} />
          <Detail icon="bicycle-outline" label="Dasher" value={order.deliveryPersonnelName ?? 'None'} />
          <Detail icon="location-outline" label="Delivered to" value={order.deliveryLocation} />
        </View>

        <ReportProblemCard
          reported={reported}
          onSubmit={async (note) => {
            if (!token) return;
            await PaymentCenterService.reportOrder(order.id, note, token);
            setReported(true);
          }}
          placeholder={cod
            ? "e.g. The dasher handed over less cash than the order's drinks total"
            : "e.g. This order's payment doesn't match what we received"}
          reportedText="You reported a problem with this order."
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function Detail({ icon, label, value }: { icon: any; label: string; value?: string | null }) {
  return (
    <View style={styles.detail}>
      <Ionicons name={icon} size={16} color={COLORS.primary} style={{ marginTop: 2 }} />
      <View style={{ flex: 1 }}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value || '—'}</Text>
      </View>
    </View>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
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
  topBarIcon: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  topBarTitle: { flex: 1, fontSize: 16, fontWeight: '600', color: COLORS.text, textAlign: 'center' },
  content: { padding: SIZES.screenPadding, paddingBottom: 32 },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  date: { fontSize: SIZES.captionSize, color: COLORS.textSecondary },
  pill: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  pillDelivered: { backgroundColor: '#E6F4EA' },
  pillCancelled: { backgroundColor: '#F5F5F5' },
  pillText: { fontSize: SIZES.smallSize, fontWeight: '600' },
  pillTextDelivered: { color: '#1E8E3E' },
  pillTextCancelled: { color: '#666' },
  card: { backgroundColor: COLORS.white, borderRadius: 12, padding: 14, marginBottom: 12 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 6 },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 6, gap: 8 },
  itemName: { fontSize: SIZES.captionSize, fontWeight: '600', color: COLORS.text },
  itemOptions: { fontSize: SIZES.smallSize, color: COLORS.textSecondary, marginTop: 2 },
  itemPrice: { fontSize: SIZES.captionSize, color: COLORS.text },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 8 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between' },
  totalLabel: { fontSize: SIZES.captionSize, fontWeight: '600', color: COLORS.text },
  totalValue: { fontSize: SIZES.bodySize, fontWeight: '700', color: COLORS.text },
  detail: { flexDirection: 'row', gap: 10, paddingVertical: 6 },
  detailLabel: { fontSize: SIZES.smallSize, color: COLORS.textSecondary },
  detailValue: { fontSize: SIZES.captionSize, color: COLORS.text, marginTop: 1 },
});
