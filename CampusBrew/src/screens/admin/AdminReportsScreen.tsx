import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SIZES } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { AdminService, AdminReport, ReportStatus } from '../../services/AdminService';
import { FilterTabs, StatusChip, formatDate } from './adminUi';

const FILTERS: { label: string; value: ReportStatus }[] = [
  { label: 'Open', value: 'OPEN' },
  { label: 'Resolved', value: 'RESOLVED' },
];

/** Reports from users: flagged chats and payment problems. */
export default function AdminReportsScreen({ navigation }: any) {
  const { token } = useAuth();
  const [filter, setFilter] = useState<ReportStatus>('OPEN');
  const [items, setItems] = useState<AdminReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setItems(await AdminService.reports(filter, token));
      setError(null);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load reports');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, filter]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Reports</Text>
      </View>
      <FilterTabs options={FILTERS} value={filter} onChange={(v) => { setLoading(true); setFilter(v); }} />

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={COLORS.primary} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.primary} />
          }
        >
          {error && <Text style={styles.error}>{error}</Text>}
          {!error && items.length === 0 && (
            <View style={styles.empty}>
              <Ionicons name="flag-outline" size={36} color={COLORS.textSecondary} />
              <Text style={styles.emptyText}>{filter === 'OPEN' ? 'No open reports.' : 'No resolved reports yet.'}</Text>
            </View>
          )}
          {items.map((r) => (
            <TouchableOpacity
              key={r.id}
              style={styles.card}
              onPress={() => navigation.navigate('AdminReportDetail', { id: r.id })}
              activeOpacity={0.8}
            >
              <View style={styles.icon}>
                <Ionicons
                  name={r.type === 'CHAT' ? 'chatbubbles-outline' : 'card-outline'}
                  size={20}
                  color={COLORS.primary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{reportTitle(r)}</Text>
                {r.type === 'PAYMENT' && !!r.note && (
                  <Text style={styles.note} numberOfLines={2}>“{r.note}”</Text>
                )}
                <Text style={styles.meta}>
                  By {r.reporterName ?? 'a user'} · {formatDate(r.createdAt)}
                </Text>
              </View>
              <StatusChip status={r.status} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

export function reportTitle(r: AdminReport) {
  const order = r.orderId ? ` · Order #${r.orderId.slice(-6).toUpperCase()}` : '';
  if (r.type === 'CHAT') {
    return `${r.channel === 'SHOP' ? 'Shop' : 'Dasher'} chat${order}`;
  }
  return `Payment problem${order}`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.backgroundSecondary },
  header: { backgroundColor: COLORS.background, paddingHorizontal: SIZES.screenPadding, paddingTop: 12, paddingBottom: 4 },
  title: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: SIZES.screenPadding, paddingBottom: 32 },
  error: { color: '#D93025', marginBottom: 12 },
  empty: { alignItems: 'center', marginTop: 48, gap: 8 },
  emptyText: { color: COLORS.textSecondary, fontSize: SIZES.captionSize },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  name: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  note: { fontSize: SIZES.smallSize, color: COLORS.text, marginTop: 2 },
  meta: { fontSize: SIZES.smallSize, color: COLORS.textSecondary, marginTop: 2 },
});
