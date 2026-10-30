import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../components/ConfirmDialog';
import { AdminService, AdminReport } from '../../services/AdminService';
import { InfoRow, StatusChip, formatDate } from './adminUi';
import { reportTitle } from './AdminReportsScreen';

type Person = NonNullable<AdminReport['people']>[number];

/** One report: the flagged conversation or payment, who's involved, suspend / resolve. */
export default function AdminReportDetailScreen({ route, navigation }: any) {
  const id: string = route?.params?.id;
  const { token } = useAuth();
  const { confirm, notify, dialog } = useConfirm();
  const [report, setReport] = useState<AdminReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setReport(await AdminService.report(id, token));
    } catch (e: any) {
      setError(e.message ?? 'Failed to load the report');
    }
  }, [id, token]);

  useEffect(() => { load(); }, [load]);

  const toggleSuspension = async (p: Person) => {
    if (!token || !report) return;
    const suspending = !p.suspended;
    const ok = await confirm({
      title: suspending ? `Suspend ${p.name}?` : `Lift ${p.name}'s suspension?`,
      message: suspending
        ? "They'll be signed out and won't be able to log in until you lift it."
        : 'They will be able to log in again.',
      confirmLabel: suspending ? 'Suspend' : 'Lift suspension',
      destructive: suspending,
      icon: suspending ? 'ban-outline' : 'lock-open-outline',
    });
    if (!ok) return;
    setBusy(p.userId);
    try {
      if (suspending) {
        await AdminService.suspend(p.userId, `From a ${report.type === 'CHAT' ? 'chat' : 'payment'} report`, token);
      } else {
        await AdminService.unsuspend(p.userId, token);
      }
      await load();
    } catch (e: any) {
      notify('Could not update', e.message ?? 'Please try again.', { icon: 'alert-circle-outline' });
    } finally {
      setBusy(null);
    }
  };

  const resolve = async () => {
    if (!token || !report) return;
    const ok = await confirm({
      title: 'Mark as resolved?',
      message: 'It moves to the Resolved list.',
      confirmLabel: 'Resolve',
      icon: 'checkmark-done-outline',
    });
    if (!ok) return;
    setBusy('resolve');
    try {
      setReport(await AdminService.resolve(report.id, token));
    } catch (e: any) {
      notify('Could not resolve', e.message ?? 'Please try again.', { icon: 'alert-circle-outline' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.topBarIcon} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Report</Text>
        <View style={styles.topBarIcon} />
      </View>

      {!report ? (
        <View style={styles.center}>
          {error ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator color={COLORS.primary} />}
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.headRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{reportTitle(report)}</Text>
                <Text style={styles.meta}>
                  Reported by {report.reporterName ?? 'a user'} · {formatDate(report.createdAt)}
                </Text>
              </View>
              <StatusChip status={report.status} />
            </View>

            {report.type === 'CHAT' ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Conversation</Text>
                {(report.messages ?? []).length === 0 && <Text style={styles.meta}>No messages were kept.</Text>}
                {(report.messages ?? []).map((m, i) => (
                  <View key={i} style={styles.message}>
                    <Text style={styles.sender}>
                      {m.senderName} <Text style={styles.time}>· {formatDate(m.createdAt)}</Text>
                    </Text>
                    <Text style={styles.text}>{m.text}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Payment</Text>
                <InfoRow icon="chatbox-ellipses-outline" label="What they reported" value={report.note} />
                {report.payment ? (
                  <>
                    <InfoRow icon="cash-outline" label="Amount" value={`₱${report.payment.amount.toFixed(2)}`} />
                    <InfoRow
                      icon="card-outline"
                      label="Type / method"
                      value={`${report.payment.type ?? '—'} · ${report.payment.method ?? '—'}`}
                    />
                    <InfoRow icon="pulse-outline" label="Status" value={report.payment.status} />
                    <InfoRow icon="receipt-outline" label="Reference no." value={report.payment.referenceNo} />
                    <InfoRow icon="time-outline" label="Paid at" value={formatDate(report.payment.createdAt)} />
                  </>
                ) : (
                  <Text style={styles.meta}>Payment record not found.</Text>
                )}
              </View>
            )}

            <View style={styles.card}>
              <Text style={styles.cardTitle}>People involved</Text>
              {(report.people ?? []).map((p) => (
                <View key={p.userId} style={styles.person}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.personName}>
                      {p.name} {p.reporter && <Text style={styles.reporterTag}>reporter</Text>}
                    </Text>
                    <Text style={styles.meta}>
                      {p.role}
                      {p.suspended ? ' · Suspended' : ''}
                    </Text>
                  </View>
                  {p.role !== 'Admin' && (
                    <TouchableOpacity
                      style={[styles.smallBtn, p.suspended ? styles.liftBtn : styles.suspendBtn]}
                      onPress={() => toggleSuspension(p)}
                      disabled={busy != null}
                    >
                      {busy === p.userId ? (
                        <ActivityIndicator size="small" color={p.suspended ? COLORS.primary : '#D93025'} />
                      ) : (
                        <Text style={p.suspended ? styles.liftText : styles.suspendText}>
                          {p.suspended ? 'Lift' : 'Suspend'}
                        </Text>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          </ScrollView>

          {report.status === 'OPEN' && (
            <TouchableOpacity style={styles.resolveBtn} onPress={resolve} disabled={busy != null}>
              {busy === 'resolve' ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.resolveText}>Mark as Resolved</Text>
              )}
            </TouchableOpacity>
          )}
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
  message: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  sender: { fontSize: SIZES.smallSize, fontWeight: '700', color: COLORS.text },
  time: { fontWeight: '400', color: COLORS.textSecondary },
  text: { fontSize: SIZES.captionSize, color: COLORS.text, marginTop: 2 },
  person: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 8 },
  personName: { fontSize: SIZES.captionSize, fontWeight: '600', color: COLORS.text },
  reporterTag: { fontSize: 11, color: COLORS.primary, fontWeight: '600' },
  smallBtn: { paddingHorizontal: 14, height: 32, borderRadius: 16, justifyContent: 'center', borderWidth: 1 },
  suspendBtn: { borderColor: '#D93025' },
  suspendText: { color: '#D93025', fontWeight: '700', fontSize: SIZES.smallSize },
  liftBtn: { borderColor: COLORS.primary },
  liftText: { color: COLORS.primary, fontWeight: '700', fontSize: SIZES.smallSize },
  resolveBtn: {
    height: SIZES.buttonHeight,
    backgroundColor: COLORS.primary,
    borderRadius: SIZES.buttonBorderRadius,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: SIZES.screenPadding,
    marginBottom: 12,
  },
  resolveText: { color: COLORS.white, fontSize: 15, fontWeight: '700' },
});
