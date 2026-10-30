import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SIZES } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { AdminService, AdminApplication } from '../../services/AdminService';
import type { ApplicationStatus } from '../../services/DasherApplicationService';
import { FilterTabs, StatusChip, formatDate } from './adminUi';

const FILTERS: { label: string; value: ApplicationStatus }[] = [
  { label: 'Pending', value: 'PENDING' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Rejected', value: 'REJECTED' },
];

/** Admin home: dasher applications, pending ones oldest first. */
export default function AdminApplicationsScreen({ navigation }: any) {
  const { token } = useAuth();
  const [filter, setFilter] = useState<ApplicationStatus>('PENDING');
  const [items, setItems] = useState<AdminApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setItems(await AdminService.applications(filter, token));
      setError(null);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load applications');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, filter]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Dasher Applications</Text>
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
              <Ionicons name="document-text-outline" size={36} color={COLORS.textSecondary} />
              <Text style={styles.emptyText}>
                {filter === 'PENDING' ? 'No applications waiting for review.' : `No ${filter.toLowerCase()} applications.`}
              </Text>
            </View>
          )}
          {items.map((a) => (
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
        </ScrollView>
      )}
    </SafeAreaView>
  );
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
    gap: 8,
  },
  name: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  meta: { fontSize: SIZES.smallSize, color: COLORS.textSecondary, marginTop: 2 },
});
