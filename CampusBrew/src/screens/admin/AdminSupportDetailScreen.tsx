import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../components/ConfirmDialog';
import { AdminService, AdminSupportTicket } from '../../services/AdminService';
import { InfoRow, StatusChip, RefTag, formatDate, refOf } from './adminUi';
import { TOPIC_LABEL, roleLabel } from './AdminReportsScreen';

/** One message from Contact Support: the message, the matching account, lift a suspension, resolve. */
export default function AdminSupportDetailScreen({ route, navigation }: any) {
  const id: string = route?.params?.id;
  const { token } = useAuth();
  const { confirm, notify, dialog } = useConfirm();
  const [ticket, setTicket] = useState<AdminSupportTicket | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setTicket(await AdminService.supportTicket(id, token));
    } catch (e: any) {
      setError(e.message ?? 'Failed to load the message');
    }
  }, [id, token]);

  useEffect(() => { load(); }, [load]);

  const lift = async () => {
    if (!token || !ticket?.userId) return;
    const ok = await confirm({
      title: `Lift ${ticket.accountName ?? 'this account'}'s suspension?`,
      message: 'They will be able to log in again.',
      confirmLabel: 'Lift suspension',
      icon: 'lock-open-outline',
    });
    if (!ok) return;
    setBusy('lift');
    try {
      await AdminService.unsuspend(ticket.userId, token);
      await load();
    } catch (e: any) {
      notify('Could not lift', e.message ?? 'Please try again.', { icon: 'alert-circle-outline' });
    } finally {
      setBusy(null);
    }
  };

  const resolve = async () => {
    if (!token || !ticket) return;
    setBusy('resolve');
    try {
      setTicket(await AdminService.resolveSupport(ticket.id, token));
    } catch (e: any) {
      notify('Could not resolve', e.message ?? 'Please try again.', { icon: 'alert-circle-outline' });
    } finally {
      setBusy(null);
    }
  };

  const reply = () => {
    if (!ticket) return;
    const subject = encodeURIComponent(`Re: CampusBrew support ${refOf(ticket)}`);
    Linking.openURL(`mailto:${ticket.email}?subject=${subject}`).catch(() =>
      notify('No email app', `Reply to ${ticket.email} from your email.`, { icon: 'mail-outline' }));
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.topBarIcon} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Support Message</Text>
        <View style={styles.topBarIcon} />
      </View>

      {!ticket ? (
        <View style={styles.center}>
          {error ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator color={COLORS.primary} />}
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.headRow}>
              <View style={{ flex: 1 }}>
                <RefTag value={refOf(ticket)} />
                <Text style={styles.name}>{TOPIC_LABEL[ticket.topic] ?? ticket.topic}</Text>
                <Text style={styles.meta}>Sent {formatDate(ticket.createdAt)}</Text>
              </View>
              <StatusChip status={ticket.status} />
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Message</Text>
              <Text style={styles.message}>{ticket.message}</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>From</Text>
              <InfoRow icon="mail-outline" label="Email" value={ticket.email} />
              {!!ticket.name && <InfoRow icon="person-outline" label="Name given" value={ticket.name} />}
              <InfoRow
                icon="person-circle-outline"
                label="Account"
                value={ticket.userId
                  ? `${ticket.accountName ?? '—'} · ${roleLabel(ticket.accountRole)}`
                  : 'No account with this email'}
              />
              {!!ticket.userId && (
                <InfoRow
                  icon={ticket.suspended ? 'ban-outline' : 'checkmark-circle-outline'}
                  label="Account status"
                  value={ticket.suspended
                    ? `Suspended${ticket.suspendedReason ? ` · ${ticket.suspendedReason}` : ''}`
                    : 'Active'}
                />
              )}
              {ticket.suspended && !!ticket.userId && (
                <TouchableOpacity style={styles.liftBtn} onPress={lift} disabled={busy != null}>
                  {busy === 'lift' ? <ActivityIndicator color={COLORS.primary} /> : (
                    <>
                      <Ionicons name="lock-open-outline" size={16} color={COLORS.primary} />
                      <Text style={styles.liftText}>Lift suspension</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity style={[styles.btn, styles.replyBtn]} onPress={reply}>
              <Text style={styles.replyText}>Reply by email</Text>
            </TouchableOpacity>
            {ticket.status === 'OPEN' && (
              <TouchableOpacity style={[styles.btn, styles.resolveBtn]} onPress={resolve} disabled={busy != null}>
                {busy === 'resolve' ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.resolveText}>Mark as Resolved</Text>}
              </TouchableOpacity>
            )}
          </View>
        </>
      )}
      {dialog}
    </SafeAreaView>
  );
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  error: { color: '#D93025' },
  content: { padding: SIZES.screenPadding, paddingBottom: 24 },
  headRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
  name: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  meta: { fontSize: SIZES.smallSize, color: COLORS.textSecondary, marginTop: 2 },
  card: { backgroundColor: COLORS.white, borderRadius: 12, padding: 14, marginBottom: 12 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 6 },
  message: { fontSize: SIZES.captionSize, color: COLORS.text, lineHeight: 20 },
  liftBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  liftText: { color: COLORS.primary, fontWeight: '700', fontSize: SIZES.captionSize },
  actions: { flexDirection: 'row', gap: 10, paddingHorizontal: SIZES.screenPadding, paddingBottom: 12 },
  btn: { flex: 1, height: SIZES.buttonHeight, borderRadius: SIZES.buttonBorderRadius, justifyContent: 'center', alignItems: 'center' },
  replyBtn: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.primary },
  replyText: { color: COLORS.primary, fontSize: 15, fontWeight: '700' },
  resolveBtn: { backgroundColor: COLORS.primary },
  resolveText: { color: COLORS.white, fontSize: 15, fontWeight: '700' },
});
