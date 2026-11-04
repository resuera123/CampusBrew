import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SIZES } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../components/ConfirmDialog';
import { AdminService, SuspendedUser } from '../../services/AdminService';
import { SearchBar, formatDate, matches } from './adminUi';
import { roleLabel } from './AdminReportsScreen';

/** Every suspended account, with a button to lift each suspension. */
export default function AdminSuspendedScreen() {
  const { token } = useAuth();
  const { confirm, notify, dialog } = useConfirm();
  const [users, setUsers] = useState<SuspendedUser[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setUsers(await AdminService.suspendedUsers(token));
      setError(null);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load suspended accounts');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const lift = async (u: SuspendedUser) => {
    if (!token) return;
    const ok = await confirm({
      title: `Lift ${u.fullName}'s suspension?`,
      message: 'They will be able to log in and use CampusBrew again.',
      confirmLabel: 'Lift suspension',
      icon: 'lock-open-outline',
    });
    if (!ok) return;
    setBusy(u.userId);
    try {
      await AdminService.unsuspend(u.userId, token);
      setUsers((list) => list.filter((x) => x.userId !== u.userId));
    } catch (e: any) {
      notify('Could not lift', e.message ?? 'Please try again.', { icon: 'alert-circle-outline' });
    } finally {
      setBusy(null);
    }
  };

  const shown = users.filter((u) => matches(query, u.fullName, u.email, u.reason, roleLabel(u.role)));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Suspended</Text>
        <Text style={styles.sub}>Accounts that can't log in right now.</Text>
      </View>
      <SearchBar value={query} onChange={setQuery} placeholder="Search by name, email or reason" />

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
          {!error && shown.length === 0 && (
            <View style={styles.empty}>
              <Ionicons name="shield-checkmark-outline" size={36} color={COLORS.textSecondary} />
              <Text style={styles.emptyText}>
                {users.length > 0 ? `No accounts match “${query}”.` : 'No suspended accounts.'}
              </Text>
            </View>
          )}
          {shown.map((u) => (
            <View key={u.userId} style={styles.card}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{u.fullName}</Text>
                <Text style={styles.meta}>{roleLabel(u.role)}{u.dasherApproved && u.role === 'CUSTOMER' ? ' · Dasher' : ''} · {u.email}</Text>
                {!!u.reason && <Text style={styles.reason} numberOfLines={2}>“{u.reason}”</Text>}
                <Text style={styles.meta}>Since {formatDate(u.suspendedAt)}</Text>
              </View>
              <TouchableOpacity style={styles.liftBtn} onPress={() => lift(u)} disabled={busy != null}>
                {busy === u.userId ? <ActivityIndicator size="small" color={COLORS.primary} /> : <Text style={styles.liftText}>Lift</Text>}
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}
      {dialog}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.backgroundSecondary },
  header: { backgroundColor: COLORS.background, paddingHorizontal: SIZES.screenPadding, paddingTop: 16, paddingBottom: 10 },
  title: { fontSize: 24, fontWeight: '800', color: COLORS.espresso },
  sub: { fontSize: SIZES.smallSize, color: COLORS.textSecondary, marginTop: 2 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: SIZES.screenPadding, paddingBottom: 32 },
  error: { color: '#D93025', marginBottom: 12 },
  empty: { alignItems: 'center', marginTop: 48, gap: 8 },
  emptyText: { color: COLORS.textSecondary, fontSize: SIZES.captionSize },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: SIZES.cardRadius,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  name: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  meta: { fontSize: SIZES.smallSize, color: COLORS.textSecondary, marginTop: 2 },
  reason: { fontSize: SIZES.smallSize, color: COLORS.text, marginTop: 4, fontStyle: 'italic' },
  liftBtn: {
    paddingHorizontal: 16,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  liftText: { color: COLORS.primary, fontWeight: '700', fontSize: SIZES.smallSize },
});
