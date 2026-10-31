import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SIZES } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { AdminService, AdminApplication, AdminShopApplication } from '../../services/AdminService';
import type { ApplicationStatus } from '../../services/DasherApplicationService';
import { FilterTabs, StatusChip, formatDate } from './adminUi';

type Kind = 'DASHER' | 'SHOP';

const KINDS: { label: string; value: Kind }[] = [
  { label: 'Dashers', value: 'DASHER' },
  { label: 'Shops', value: 'SHOP' },
];

const FILTERS: { label: string; value: ApplicationStatus }[] = [
  { label: 'Pending', value: 'PENDING' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Rejected', value: 'REJECTED' },
];

/** Admin home: dasher and shop applications, pending ones oldest first. */
export default function AdminApplicationsScreen({ navigation }: any) {
  const { token } = useAuth();
  const [kind, setKind] = useState<Kind>('DASHER');
  const [filter, setFilter] = useState<ApplicationStatus>('PENDING');
  const [dashers, setDashers] = useState<AdminApplication[]>([]);
  const [shops, setShops] = useState<AdminShopApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      if (kind === 'DASHER') {
        setDashers(await AdminService.applications(filter, token));
      } else {
        setShops(await AdminService.shopApplications(filter, token));
      }
      setError(null);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load applications');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, filter, kind]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const count = kind === 'DASHER' ? dashers.length : shops.length;
  const noun = kind === 'DASHER' ? 'dasher' : 'shop';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Applications</Text>
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
          {!error && count === 0 && (
            <View style={styles.empty}>
              <Ionicons name={kind === 'DASHER' ? 'bicycle-outline' : 'storefront-outline'} size={36} color={COLORS.textSecondary} />
              <Text style={styles.emptyText}>
                {filter === 'PENDING'
                  ? `No ${noun} applications waiting for review.`
                  : `No ${filter.toLowerCase()} ${noun} applications.`}
              </Text>
            </View>
          )}

          {kind === 'DASHER' && dashers.map((a) => (
            <TouchableOpacity
              key={a.id}
              style={styles.card}
              onPress={() => navigation.navigate('AdminApplicationDetail', { id: a.id })}
              activeOpacity={0.8}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{a.fullName ?? 'Applicant'}</Text>
                <Text style={styles.meta}>
                  {a.course} · Year {a.yearLevel} · {a.studentId ?? 'no student ID'}
                </Text>
                <Text style={styles.meta}>Applied {formatDate(a.createdAt)}</Text>
              </View>
              <StatusChip status={a.status} />
              <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>
          ))}

          {kind === 'SHOP' && shops.map((a) => (
            <TouchableOpacity
              key={a.id}
              style={styles.card}
              onPress={() => navigation.navigate('AdminShopApplicationDetail', { id: a.id })}
              activeOpacity={0.8}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{a.stallName}</Text>
                <Text style={styles.meta}>{a.location}</Text>
                <Text style={styles.meta}>
                  {a.operatorName} · Applied {formatDate(a.createdAt)}
                </Text>
              </View>
              <StatusChip status={a.status} />
              <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.backgroundSecondary },
  header: { backgroundColor: COLORS.background, paddingHorizontal: SIZES.screenPadding, paddingTop: 12, paddingBottom: 4 },
  title: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  kinds: { flexDirection: 'row', backgroundColor: COLORS.backgroundSecondary, borderRadius: 18, padding: 3, marginTop: 10 },
  kind: { flex: 1, paddingVertical: 7, borderRadius: 15, alignItems: 'center' },
  kindOn: { backgroundColor: COLORS.primary },
  kindText: { fontSize: SIZES.captionSize, fontWeight: '600', color: COLORS.text },
  kindTextOn: { color: COLORS.white },
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
    gap: 8,
  },
  name: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  meta: { fontSize: SIZES.smallSize, color: COLORS.textSecondary, marginTop: 2 },
});
