import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../components/ConfirmDialog';
import { AdminService, AdminVerification } from '../../services/AdminService';
import { InfoRow, StatusChip, RefTag, ReappliedBadge, ReasonDialog, formatDate, refOf } from './adminUi';

/**
 * One CIT-U verification request. The customer already confirmed the code sent
 * to their school email; the admin checks the student ID and approves or rejects.
 */
export default function AdminVerificationDetailScreen({ route, navigation }: any) {
  const id: string = route?.params?.id;
  const { token } = useAuth();
  const { confirm, notify, dialog } = useConfirm();
  const [app, setApp] = useState<AdminVerification | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setApp(await AdminService.verification(id, token));
    } catch (e: any) {
      setError(e.message ?? 'Failed to load the request');
    }
  }, [id, token]);

  useEffect(() => { load(); }, [load]);

  const approve = async () => {
    if (!token || !app) return;
    const ok = await confirm({
      title: 'Verify this account?',
      message: `${app.fullName ?? 'This customer'} gets Cash on Delivery and can apply to be a dasher.`,
      confirmLabel: 'Verify',
      icon: 'shield-checkmark-outline',
    });
    if (!ok) return;
    setBusy(true);
    try {
      await AdminService.approveVerification(app.id, token);
      await notify('Verified', `${app.fullName ?? 'The customer'} has been notified.`, { icon: 'checkmark-circle' });
      navigation.goBack();
    } catch (e: any) {
      notify('Could not verify', e.message ?? 'Please try again.', { icon: 'alert-circle-outline' });
    } finally {
      setBusy(false);
    }
  };

  const reject = async (reason: string) => {
    if (!token || !app) return;
    try {
      await AdminService.rejectVerification(app.id, reason, token);
      setRejectOpen(false);
      await notify('Rejected', 'They can see your reason and send it again.', { icon: 'close-circle' });
      navigation.goBack();
    } catch (e: any) {
      notify('Could not reject', e.message ?? 'Please try again.', { icon: 'alert-circle-outline' });
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.topBarIcon} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Verification Request</Text>
        <View style={styles.topBarIcon} />
      </View>

      {!app ? (
        <View style={styles.center}>
          {error ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator color={COLORS.primary} />}
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.headRow}>
              <View style={{ flex: 1 }}>
                <RefTag value={refOf(app)} />
                <Text style={styles.name}>{app.fullName ?? 'Customer'}</Text>
                <Text style={styles.meta}>Sent {formatDate(app.createdAt)}</Text>
              </View>
              <StatusChip status={app.status} />
            </View>
            {app.status === 'REJECTED' && !!app.rejectionReason && (
              <Text style={styles.rejected}>Rejected: {app.rejectionReason}</Text>
            )}

            <View style={styles.card}>
              <Text style={styles.cardTitle}>CIT-U details</Text>
              <InfoRow icon="id-card-outline" label="Student ID" value={app.studentId} />
              <InfoRow icon="school-outline" label="CIT-U email (code confirmed)" value={app.schoolEmail} />
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Account</Text>
              <InfoRow icon="person-outline" label="Name" value={app.fullName} />
              <InfoRow icon="mail-outline" label="Login email" value={app.email} />
              <InfoRow icon="call-outline" label="Mobile" value={app.phoneNumber} />
            </View>

            <View style={styles.tip}>
              <Ionicons name="information-circle-outline" size={16} color={COLORS.textSecondary} />
              <Text style={styles.tipText}>
                Check that the student ID format and the name fit the CIT-U email. Reject with a reason if something
                doesn't match; they can fix it and send it again.
              </Text>
            </View>
          </ScrollView>

          {app.status === 'PENDING' && (
            <View style={styles.actions}>
              <TouchableOpacity style={[styles.btn, styles.rejectBtn]} onPress={() => setRejectOpen(true)} disabled={busy}>
                <Text style={styles.rejectText}>Reject</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.approveBtn]} onPress={approve} disabled={busy}>
                {busy ? <ActivityIndicator color={COLORS.white} /> : (
                  <View style={styles.approveInner}>
                    <Text style={styles.approveText}>Approve</Text>
                    {app.reapplied && <ReappliedBadge />}
                  </View>
                )}
              </TouchableOpacity>
            </View>
          )}
        </>
      )}

      <ReasonDialog
        visible={rejectOpen}
        title="Reject verification"
        message="The customer sees this reason and can send their details again."
        label="Reason for rejecting"
        placeholder="e.g. The student ID doesn't match this CIT-U email."
        confirmLabel="Reject"
        icon="close-circle-outline"
        required
        onCancel={() => setRejectOpen(false)}
        onConfirm={reject}
      />
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
  headRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  name: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  meta: { fontSize: SIZES.smallSize, color: COLORS.textSecondary, marginTop: 2 },
  rejected: { color: '#D93025', marginBottom: 12, fontSize: SIZES.captionSize },
  card: { backgroundColor: COLORS.white, borderRadius: 12, padding: 14, marginBottom: 12 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  tip: { flexDirection: 'row', gap: 8, paddingHorizontal: 4 },
  tipText: { flex: 1, fontSize: SIZES.smallSize, color: COLORS.textSecondary, lineHeight: 17 },
  actions: { flexDirection: 'row', gap: 10, paddingHorizontal: SIZES.screenPadding, paddingBottom: 12 },
  btn: { flex: 1, height: SIZES.buttonHeight, borderRadius: SIZES.buttonBorderRadius, justifyContent: 'center', alignItems: 'center' },
  approveBtn: { backgroundColor: '#1E8E3E' },
  approveText: { color: COLORS.white, fontSize: 15, fontWeight: '700' },
  approveInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rejectBtn: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.destructive },
  rejectText: { color: COLORS.destructive, fontSize: 15, fontWeight: '700' },
});
