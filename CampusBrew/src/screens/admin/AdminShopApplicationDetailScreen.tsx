import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Modal,
  TextInput,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../components/ConfirmDialog';
import { AdminService, AdminShopApplication } from '../../services/AdminService';
import { InfoRow, StatusChip, formatDate } from './adminUi';

/** One shop application: details, photos (tap to enlarge), approve or reject with a reason. */
export default function AdminShopApplicationDetailScreen({ route, navigation }: any) {
  const id: string = route?.params?.id;
  const { token } = useAuth();
  const { confirm, notify, dialog } = useConfirm();
  const [app, setApp] = useState<AdminShopApplication | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setApp(await AdminService.shopApplication(id, token));
    } catch (e: any) {
      setError(e.message ?? 'Failed to load the application');
    }
  }, [id, token]);

  useEffect(() => { load(); }, [load]);

  const approve = async () => {
    if (!token || !app) return;
    const ok = await confirm({
      title: 'Approve shop?',
      message: `${app.stallName} will appear to customers and can open for orders.`,
      confirmLabel: 'Approve',
      icon: 'checkmark-circle-outline',
    });
    if (!ok) return;
    setBusy(true);
    try {
      await AdminService.approveShop(app.id, token);
      await notify('Approved', `${app.operatorName} has been notified.`, { icon: 'checkmark-circle' });
      navigation.goBack();
    } catch (e: any) {
      notify('Could not approve', e.message ?? 'Please try again.', { icon: 'alert-circle-outline' });
    } finally {
      setBusy(false);
    }
  };

  const reject = async () => {
    if (!token || !app || !reason.trim()) return;
    setBusy(true);
    try {
      await AdminService.rejectShop(app.id, reason.trim(), token);
      setRejectOpen(false);
      await notify('Rejected', 'The operator can see your reason and apply again.', { icon: 'close-circle' });
      navigation.goBack();
    } catch (e: any) {
      notify('Could not reject', e.message ?? 'Please try again.', { icon: 'alert-circle-outline' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.topBarIcon} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Shop Application</Text>
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
                <Text style={styles.name}>{app.stallName}</Text>
                <Text style={styles.meta}>Applied {formatDate(app.createdAt)}</Text>
              </View>
              <StatusChip status={app.status} />
            </View>
            {app.status === 'REJECTED' && !!app.rejectionReason && (
              <Text style={styles.rejected}>Rejected: {app.rejectionReason}</Text>
            )}

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Shop</Text>
              <InfoRow icon="storefront-outline" label="Stall / business name" value={app.stallName} />
              <InfoRow icon="location-outline" label="Location on campus" value={app.location} />
              <InfoRow icon="checkbox-outline" label="Shop rules" value={app.agreedToRules ? 'Agreed' : 'Not agreed'} />
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Operator</Text>
              <InfoRow icon="person-outline" label="Full name" value={app.operatorName} />
              <InfoRow icon="call-outline" label="Mobile" value={app.phoneNumber} />
              <InfoRow icon="mail-outline" label="Account" value={`${app.accountName ?? '—'} · ${app.email ?? '—'}`} />
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Photos</Text>
              <Text style={styles.meta}>Tap a photo to enlarge it. Check the ID name matches the operator.</Text>
              <View style={styles.photos}>
                {[
                  { uri: app.stallPhoto, label: 'Stall' },
                  { uri: app.idPhoto, label: 'Valid ID' },
                ].map((p) => (
                  <TouchableOpacity key={p.label} style={styles.photoWrap} onPress={() => p.uri && setViewing(p.uri)}>
                    {p.uri ? (
                      <Image source={{ uri: p.uri }} style={styles.photo} />
                    ) : (
                      <View style={[styles.photo, styles.noPhoto]}>
                        <Ionicons name="image-outline" size={24} color={COLORS.textSecondary} />
                      </View>
                    )}
                    <Text style={styles.photoLabel}>{p.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </ScrollView>

          {app.status === 'PENDING' && (
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.btn, styles.rejectBtn]}
                onPress={() => { setReason(''); setRejectOpen(true); }}
                disabled={busy}
              >
                <Text style={styles.rejectText}>Reject</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.approveBtn]} onPress={approve} disabled={busy}>
                {busy ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.approveText}>Approve</Text>}
              </TouchableOpacity>
            </View>
          )}
        </>
      )}

      <Modal visible={viewing != null} transparent animationType="fade" onRequestClose={() => setViewing(null)}>
        <Pressable style={styles.viewer} onPress={() => setViewing(null)}>
          {viewing && <Image source={{ uri: viewing }} style={styles.viewerImage} resizeMode="contain" />}
          <Text style={styles.viewerHint}>Tap anywhere to close</Text>
        </Pressable>
      </Modal>

      <Modal visible={rejectOpen} transparent animationType="fade" onRequestClose={() => !busy && setRejectOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Reject shop application</Text>
            <Text style={styles.meta}>The operator sees this reason and can apply again.</Text>
            <TextInput
              style={styles.reasonInput}
              value={reason}
              onChangeText={setReason}
              placeholder="e.g. The stall photo doesn't show your signage — please retake it."
              placeholderTextColor={COLORS.textSecondary}
              maxLength={200}
              multiline
              autoFocus
            />
            <View style={styles.sheetActions}>
              <TouchableOpacity style={[styles.btn, styles.cancelBtn]} onPress={() => setRejectOpen(false)} disabled={busy}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.dangerBtn, !reason.trim() && { opacity: 0.4 }]}
                onPress={reject}
                disabled={busy || !reason.trim()}
              >
                {busy ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.approveText}>Reject</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  photos: { flexDirection: 'row', gap: 10, marginTop: 10 },
  photoWrap: { flex: 1, alignItems: 'center' },
  photo: { width: '100%', aspectRatio: 1, borderRadius: 8, backgroundColor: COLORS.backgroundSecondary },
  noPhoto: { justifyContent: 'center', alignItems: 'center' },
  photoLabel: { fontSize: 11, color: COLORS.textSecondary, marginTop: 4 },
  actions: { flexDirection: 'row', gap: 10, paddingHorizontal: SIZES.screenPadding, paddingBottom: 12 },
  btn: { flex: 1, height: SIZES.buttonHeight, borderRadius: SIZES.buttonBorderRadius, justifyContent: 'center', alignItems: 'center' },
  approveBtn: { backgroundColor: '#1E8E3E' },
  approveText: { color: COLORS.white, fontSize: 15, fontWeight: '700' },
  rejectBtn: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: '#D93025' },
  rejectText: { color: '#D93025', fontSize: 15, fontWeight: '700' },
  viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' },
  viewerImage: { width: '100%', height: '80%' },
  viewerHint: { color: '#FFFFFF', marginTop: 12, fontSize: SIZES.smallSize },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', paddingHorizontal: 24 },
  sheet: { backgroundColor: COLORS.background, borderRadius: 16, padding: 20 },
  sheetTitle: { fontSize: SIZES.bodySize, fontWeight: '700', color: COLORS.text },
  reasonInput: {
    marginTop: 12,
    minHeight: 80,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: SIZES.captionSize,
    color: COLORS.text,
    textAlignVertical: 'top',
  },
  sheetActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelBtn: { backgroundColor: COLORS.backgroundSecondary },
  cancelText: { color: COLORS.text, fontWeight: '600', fontSize: SIZES.captionSize },
  dangerBtn: { backgroundColor: '#D93025' },
});
