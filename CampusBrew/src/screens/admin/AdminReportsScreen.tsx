import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SIZES } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { AdminService, AdminReport, AdminSupportTicket, ReportStatus } from '../../services/AdminService';
import { FilterTabs, StatusChip, SearchBar, RefTag, formatDate, matches, refOf } from './adminUi';

type Kind = 'REPORTS' | 'SUPPORT';

const KINDS: { label: string; value: Kind }[] = [
  { label: 'Reports', value: 'REPORTS' },
  { label: 'Support', value: 'SUPPORT' },
];

const FILTERS: { label: string; value: ReportStatus }[] = [
  { label: 'Open', value: 'OPEN' },
  { label: 'Resolved', value: 'RESOLVED' },
];

export const TOPIC_LABEL: Record<string, string> = {
  APPEAL: 'Suspension appeal',
  QUESTION: 'Question',
  OTHER: 'Other',
};

export function roleLabel(role?: string | null) {
  switch (role) {
    case 'CUSTOMER': return 'Customer';
    case 'DELIVERY_PERSONNEL': return 'Dasher';
    case 'SHOP_OPERATOR': return 'Shop operator';
    case 'ADMIN': return 'Admin';
    default: return 'User';
  }
}

/** Reports from users (flagged chats, payment problems) and Contact Support messages. */
export default function AdminReportsScreen({ navigation }: any) {
  const { token } = useAuth();
  const [kind, setKind] = useState<Kind>('REPORTS');
  const [filter, setFilter] = useState<ReportStatus>('OPEN');
  const [items, setItems] = useState<AdminReport[]>([]);
  const [tickets, setTickets] = useState<AdminSupportTicket[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      if (kind === 'REPORTS') {
        setItems(await AdminService.reports(filter, token));
      } else {
        setTickets(await AdminService.supportTickets(filter, token));
      }
      setError(null);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, filter, kind]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const shownReports = items.filter((r) => matches(query, refOf(r), reportTitle(r), r.reporterName, r.note));
  const shownTickets = tickets.filter((t) =>
    matches(query, refOf(t), t.email, t.name, t.accountName, TOPIC_LABEL[t.topic], t.message));
  const total = kind === 'REPORTS' ? items.length : tickets.length;
  const count = kind === 'REPORTS' ? shownReports.length : shownTickets.length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Reports</Text>
        <View style={styles.kinds}>
          {KINDS.map((k) => (
            <TouchableOpacity
              key={k.value}
              style={[styles.kind, kind === k.value && styles.kindOn]}
              onPress={() => { if (kind !== k.value) { setLoading(true); setKind(k.value); } }}
            >
              <Text style={[styles.kindText, kind === k.value && styles.kindTextOn]}>{k.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <FilterTabs options={FILTERS} value={filter} onChange={(v) => { setLoading(true); setFilter(v); }} />
      <SearchBar
        value={query}
        onChange={setQuery}
        placeholder={kind === 'REPORTS' ? 'Search by report ID (RPT-0001) or name' : 'Search by ticket ID (SUP-0001) or email'}
      />

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={COLORS.primary} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.primary} />
          }
        >
          {error && <Text style={styles.error}>{error}</Text>}
          {!error && count === 0 && (
            <View style={styles.empty}>
              <Ionicons name={kind === 'REPORTS' ? 'flag-outline' : 'help-buoy-outline'} size={36} color={COLORS.textSecondary} />
              <Text style={styles.emptyText}>
                {total > 0
                  ? `Nothing matches “${query}”.`
                  : kind === 'REPORTS'
                    ? (filter === 'OPEN' ? 'No open reports.' : 'No resolved reports yet.')
                    : (filter === 'OPEN' ? 'No support messages waiting.' : 'No resolved support messages yet.')}
              </Text>
            </View>
          )}

          {kind === 'REPORTS' && shownReports.map((r) => (
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
                <RefTag value={refOf(r)} />
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

          {kind === 'SUPPORT' && shownTickets.map((t) => (
            <TouchableOpacity
              key={t.id}
              style={styles.card}
              onPress={() => navigation.navigate('AdminSupportDetail', { id: t.id })}
              activeOpacity={0.8}
            >
              <View style={styles.icon}>
                <Ionicons
                  name={t.topic === 'APPEAL' ? 'shield-checkmark-outline' : 'help-circle-outline'}
                  size={20}
                  color={COLORS.primary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <RefTag value={refOf(t)} />
                <Text style={styles.name}>{TOPIC_LABEL[t.topic] ?? t.topic}</Text>
                <Text style={styles.note} numberOfLines={2}>{t.message}</Text>
                <Text style={styles.meta}>{t.name || t.accountName || t.email} · {formatDate(t.createdAt)}</Text>
              </View>
              <View style={styles.chips}>
                {t.suspended && <StatusChip status="SUSPENDED" />}
                <StatusChip status={t.status} />
              </View>
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
  header: { backgroundColor: COLORS.background, paddingHorizontal: SIZES.screenPadding, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 24, fontWeight: '800', color: COLORS.espresso },
  kinds: { flexDirection: 'row', backgroundColor: COLORS.backgroundSecondary, borderRadius: 18, padding: 3, marginTop: 10 },
  kind: { flex: 1, paddingVertical: 7, borderRadius: 15, alignItems: 'center' },
  kindOn: { backgroundColor: COLORS.primary },
  kindText: { fontSize: SIZES.captionSize, fontWeight: '600', color: COLORS.text },
  kindTextOn: { color: COLORS.white },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: SIZES.screenPadding, paddingBottom: 32 },
  error: { color: '#D93025', marginBottom: 12 },
  empty: { alignItems: 'center', marginTop: 48, gap: 8 },
  emptyText: { color: COLORS.textSecondary, fontSize: SIZES.captionSize, textAlign: 'center' },
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
  chips: { alignItems: 'flex-end', gap: 4 },
  name: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  note: { fontSize: SIZES.smallSize, color: COLORS.text, marginTop: 2 },
  meta: { fontSize: SIZES.smallSize, color: COLORS.textSecondary, marginTop: 2 },
});
