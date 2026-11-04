import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SIZES } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import {
  AdminService, AdminApplication, AdminShopApplication, AdminVerification,
} from '../../services/AdminService';
import type { ApplicationStatus } from '../../services/DasherApplicationService';
import {
  FilterTabs, StatusChip, SearchBar, RefTag, ReappliedBadge, formatDate, matches, refOf,
} from './adminUi';

type Kind = 'USER' | 'DASHER' | 'SHOP';

const KINDS: { label: string; value: Kind }[] = [
  { label: 'Users', value: 'USER' },
  { label: 'Dashers', value: 'DASHER' },
  { label: 'Shops', value: 'SHOP' },
];

const FILTERS: { label: string; value: ApplicationStatus }[] = [
  { label: 'Pending', value: 'PENDING' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Rejected', value: 'REJECTED' },
];

const NOUN: Record<Kind, string> = { USER: 'verification', DASHER: 'dasher', SHOP: 'shop' };
const ICON: Record<Kind, any> = { USER: 'id-card-outline', DASHER: 'bicycle-outline', SHOP: 'storefront-outline' };

/** Admin home: user verifications, dasher and shop applications, pending ones oldest first. */
export default function AdminApplicationsScreen({ navigation }: any) {
  const { token } = useAuth();
  const [kind, setKind] = useState<Kind>('USER');
  const [filter, setFilter] = useState<ApplicationStatus>('PENDING');
  const [users, setUsers] = useState<AdminVerification[]>([]);
  const [dashers, setDashers] = useState<AdminApplication[]>([]);
  const [shops, setShops] = useState<AdminShopApplication[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      if (kind === 'USER') {
        setUsers(await AdminService.verifications(filter, token));
      } else if (kind === 'DASHER') {
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

  const shownUsers = users.filter((a) => matches(query, refOf(a), a.fullName, a.email, a.studentId, a.schoolEmail));
  const shownDashers = dashers.filter((a) => matches(query, refOf(a), a.fullName, a.email, a.studentId, a.course));
  const shownShops = shops.filter((a) => matches(query, refOf(a), a.stallName, a.operatorName, a.accountName, a.email));
  const total = kind === 'USER' ? users.length : kind === 'DASHER' ? dashers.length : shops.length;
  const count = kind === 'USER' ? shownUsers.length : kind === 'DASHER' ? shownDashers.length : shownShops.length;
  const noun = NOUN[kind];

  const Row = ({ id, refNo, reapplied, status, title, lines, onPress }: {
    id: string; refNo?: string | null; reapplied?: boolean; status: string; title: string; lines: string[]; onPress: () => void;
  }) => (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={{ flex: 1 }}>
        <RefTag value={refOf({ id, ref: refNo })} />
        <Text style={styles.name}>{title}</Text>
        {lines.map((l) => <Text key={l} style={styles.meta}>{l}</Text>)}
      </View>
      <View style={styles.chips}>
        {reapplied && <ReappliedBadge />}
        <StatusChip status={status} />
      </View>
      <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
    </TouchableOpacity>
  );

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
      <SearchBar value={query} onChange={setQuery} placeholder={`Search ${noun}s by ID or name`} />

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
              <Ionicons name={ICON[kind]} size={36} color={COLORS.textSecondary} />
              <Text style={styles.emptyText}>
                {total > 0
                  ? `No ${noun}s match “${query}”.`
                  : filter === 'PENDING'
                    ? `No ${noun} ${kind === 'USER' ? 'requests' : 'applications'} waiting for review.`
                    : `No ${filter.toLowerCase()} ${noun} ${kind === 'USER' ? 'requests' : 'applications'}.`}
              </Text>
            </View>
          )}

          {kind === 'USER' && shownUsers.map((a) => (
            <Row
              key={a.id}
              id={a.id}
              refNo={a.ref}
              reapplied={a.reapplied}
              status={a.status}
              title={a.fullName ?? 'Customer'}
              lines={[`${a.studentId} · ${a.schoolEmail}`, `Sent ${formatDate(a.createdAt)}`]}
              onPress={() => navigation.navigate('AdminVerificationDetail', { id: a.id })}
            />
          ))}

          {kind === 'DASHER' && shownDashers.map((a) => (
            <Row
              key={a.id}
              id={a.id}
              refNo={a.ref}
              reapplied={a.reapplied}
              status={a.status}
              title={a.fullName ?? 'Applicant'}
              lines={[`${a.course} · Year ${a.yearLevel} · ${a.studentId ?? 'no student ID'}`, `Applied ${formatDate(a.createdAt)}`]}
              onPress={() => navigation.navigate('AdminApplicationDetail', { id: a.id })}
            />
          ))}

          {kind === 'SHOP' && shownShops.map((a) => (
            <Row
              key={a.id}
              id={a.id}
              refNo={a.ref}
              reapplied={a.reapplied}
              status={a.status}
              title={a.stallName}
              lines={[a.location, `${a.operatorName} · Applied ${formatDate(a.createdAt)}`]}
              onPress={() => navigation.navigate('AdminShopApplicationDetail', { id: a.id })}
            />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
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
    borderRadius: SIZES.cardRadius,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: COLORS.espresso,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  chips: { alignItems: 'flex-end', gap: 4 },
  name: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  meta: { fontSize: SIZES.smallSize, color: COLORS.textSecondary, marginTop: 2 },
});
