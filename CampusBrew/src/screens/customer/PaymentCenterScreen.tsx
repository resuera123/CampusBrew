import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, StatusBar, TouchableOpacity, FlatList, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { PaymentCenterService, PaymentCenter, PaymentCenterEntry } from '../../services/PaymentCenterService';

// v2.0 FR-4.8 — role-aware Payment Center.
const SUMMARY_LABELS: Record<string, string> = {
  totalPaid: 'Total Paid',
  earnings: 'Earnings',
  tips: 'Tips',
  cashCollected: 'Cash Collected',
  shopPayments: 'Paid to Shops',
  received: 'Received',
};

function statusColor(status: string): string {
  if (/PAID|COMPLETED/.test(status)) return '#2E7D32';
  if (/PENDING/.test(status)) return '#B8860B';
  if (/FAILED|EXPIRED|FLAGGED/.test(status)) return '#C0392B';
  return COLORS.textSecondary;
}

export default function PaymentCenterScreen({ navigation }: any) {
  const { token } = useAuth();
  const [data, setData] = useState<PaymentCenter | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setError(null);
      const res = await PaymentCenterService.get(token);
      setData(res);
    } catch (e: any) {
      setError(e.message || 'Could not load payments');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const renderEntry = ({ item }: { item: PaymentCenterEntry }) => (
    <TouchableOpacity
      style={styles.entry}
      activeOpacity={0.7}
      onPress={() => navigation.navigate('PaymentReceipt', { entry: item })}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.entryTitle}>{item.description || item.kind}</Text>
        <Text style={styles.entryMeta}>
          {item.method ?? '—'} · {new Date(item.createdAt).toLocaleDateString()}
          {item.referenceNo ? ` · ${item.referenceNo}` : ''}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={styles.entryAmount}>₱{item.amount.toFixed(0)}</Text>
        <Text style={[styles.entryStatus, { color: statusColor(item.status) }]}>{item.status}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.topBarIcon}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Payment Center</Text>
        <View style={styles.topBarIcon} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={load}><Text style={styles.retry}>Retry</Text></TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={data?.entries ?? []}
          keyExtractor={(i) => `${i.source}-${i.id}`}
          renderItem={renderEntry}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          ListHeaderComponent={
            <View style={styles.summaryRow}>
              {Object.entries(data?.summary ?? {}).map(([k, v]) => (
                <View key={k} style={styles.summaryCard}>
                  <Text style={styles.summaryValue}>₱{v.toFixed(0)}</Text>
                  <Text style={styles.summaryLabel}>{SUMMARY_LABELS[k] ?? k}</Text>
                </View>
              ))}
            </View>
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="receipt-outline" size={40} color={COLORS.textSecondary} />
              <Text style={styles.emptyText}>No payments yet</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  topBarIcon: { width: 32, height: 32, justifyContent: 'center' },
  topBarTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  errorText: { color: COLORS.textSecondary, textAlign: 'center' },
  retry: { color: COLORS.primary, fontWeight: '700', marginTop: 8 },
  emptyText: { color: COLORS.textSecondary, marginTop: 6 },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  summaryCard: {
    flexGrow: 1, minWidth: '45%', backgroundColor: COLORS.white, borderRadius: 14,
    padding: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.border,
  },
  summaryValue: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  summaryLabel: { fontSize: 12.5, color: COLORS.textSecondary, marginTop: 2 },
  entry: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.white,
    borderRadius: 12, padding: 14, marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.border,
  },
  entryTitle: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  entryMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 3 },
  entryAmount: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  entryStatus: { fontSize: 11, fontWeight: '700', marginTop: 3 },
});
