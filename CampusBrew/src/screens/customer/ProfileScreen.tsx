import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import ConfirmDialog, { useConfirm } from '../../components/ConfirmDialog';
import MyRatingCard from '../../components/MyRatingCard';
import { DeliveryService, DeliveryPersonnelProfile } from '../../services/DeliveryService';
import { DasherApplicationService, DasherStatus } from '../../services/DasherApplicationService';
import { COLORS, SIZES } from '../../constants/theme';

export default function ProfileScreen({ navigation }: any) {
  const { user, token, logout, setSession } = useAuth();
  const isVerified = user?.verificationStatus === 'VERIFIED';
  const isDP = user?.role === 'DELIVERY_PERSONNEL';
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [dpProfile, setDpProfile] = useState<DeliveryPersonnelProfile | null>(null);
  const [dasher, setDasher] = useState<DasherStatus | null>(null);
  const [switching, setSwitching] = useState(false);
  const { confirm, notify, dialog } = useConfirm();

  // v2.0 FR-3.6 — dashers see their own rating; customers see where their
  // dasher application stands. Both refresh each time the tab opens.
  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      if (isDP) {
        DeliveryService.getMyProfile(token).then(setDpProfile).catch(() => {});
      } else {
        DasherApplicationService.status(token).then(setDasher).catch(() => {});
      }
    }, [isDP, token]),
  );

  const switchTo = async (role: 'CUSTOMER' | 'DELIVERY_PERSONNEL') => {
    if (!token) return;
    const toDasher = role === 'DELIVERY_PERSONNEL';
    const ok = await confirm({
      title: toDasher ? 'Log in as Dasher?' : 'Order as Customer?',
      message: toDasher
        ? "You'll switch to the dasher side. Go online from the dasher home to get offers."
        : "You'll go offline as a dasher, so no offers will come in while you order.",
      confirmLabel: 'Switch',
      icon: toDasher ? 'bicycle-outline' : 'cafe-outline',
    });
    if (!ok) return;
    setSwitching(true);
    try {
      await setSession(await DasherApplicationService.switchRole(role, token));
    } catch (e: any) {
      notify('Could not switch', e.message ?? 'Please try again.', { icon: 'alert-circle-outline' });
    } finally {
      setSwitching(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={48} color="#94353E" />
          </View>
          <Text style={styles.name}>{user?.fullName || 'User'}</Text>
          <Text style={styles.phone}>+63 912 345 6789</Text>
        </View>

        {isDP && dpProfile && (
          <View style={styles.ratingWrap}>
            <MyRatingCard average={dpProfile.ratingAvg} count={dpProfile.ratingCount} />
          </View>
        )}

        <View style={styles.verificationSection}>
          <View style={styles.verificationRow}>
            <Text style={styles.verificationLabel}>Verification Status</Text>
            <View style={[styles.badge, isVerified ? styles.badgeGold : styles.badgeGray]}>
              <Text style={[styles.badgeText, isVerified ? styles.badgeTextGold : styles.badgeTextGray]}>
                {isVerified ? 'Verified' : 'Unverified'}
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('AccountVerification')}>
            <Text style={styles.verifyLink}>
              {isVerified ? 'Re-verify account →' : 'Verify account to unlock COD →'}
            </Text>
          </TouchableOpacity>
        </View>

        {isDP ? (
          <TouchableOpacity
            style={[styles.primaryButton, switching && styles.buttonDisabled]}
            onPress={() => switchTo('CUSTOMER')}
            disabled={switching}
            activeOpacity={0.85}
          >
            {switching ? <ActivityIndicator color="#FFFFFF" /> : (
              <>
                <Ionicons name="cafe-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.primaryButtonText}>Order as Customer</Text>
              </>
            )}
          </TouchableOpacity>
        ) : (
          dasher && (
            <DasherButton
              status={dasher}
              busy={switching}
              onApply={() => navigation.navigate('DasherApplication')}
              onSwitch={() => switchTo('DELIVERY_PERSONNEL')}
            />
          )
        )}

        <TouchableOpacity style={[styles.outlinedButton, { marginTop: 16 }]} onPress={() => navigation.navigate('EditProfile')} activeOpacity={0.7}>
          <Text style={styles.outlinedButtonText}>Edit Profile</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.outlinedButton, { marginTop: 16 }]} onPress={() => navigation.navigate('PaymentCenter')} activeOpacity={0.7}>
          <Ionicons name="card-outline" size={20} color="#94353E" style={{ marginRight: 8 }} />
          <Text style={styles.outlinedButtonText}>Payment Center</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.outlinedButton, { marginTop: 16, borderColor: '#E8E8E8' }]} onPress={() => setLogoutOpen(true)} activeOpacity={0.7}>
          <Ionicons name="log-out-outline" size={20} color="#94353E" style={{ marginRight: 8 }} />
          <Text style={styles.outlinedButtonText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>

      <ConfirmDialog
        visible={logoutOpen}
        title="Log out?"
        message="You'll be signed out and returned to the login screen."
        confirmLabel="Log out"
        destructive
        icon="log-out-outline"
        onCancel={() => setLogoutOpen(false)}
        onConfirm={() => {
          setLogoutOpen(false);
          logout();
        }}
      />
      {dialog}
    </SafeAreaView>
  );
}

/**
 * Customer side: Log in as Dasher once approved; otherwise Become a Dasher —
 * greyed out with a note until the account is verified, and replaced by a
 * status line while an application is under review.
 */
function DasherButton({
  status,
  busy,
  onApply,
  onSwitch,
}: {
  status: DasherStatus;
  busy: boolean;
  onApply: () => void;
  onSwitch: () => void;
}) {
  if (status.dasherApproved) {
    return (
      <TouchableOpacity
        style={[styles.primaryButton, busy && styles.buttonDisabled]}
        onPress={onSwitch}
        disabled={busy}
        activeOpacity={0.85}
      >
        {busy ? <ActivityIndicator color="#FFFFFF" /> : (
          <>
            <Ionicons name="bicycle-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.primaryButtonText}>Log in as Dasher</Text>
          </>
        )}
      </TouchableOpacity>
    );
  }

  if (status.applicationStatus === 'PENDING') {
    return (
      <View>
        <View style={[styles.primaryButton, styles.buttonDisabled]}>
          <Ionicons name="time-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
          <Text style={styles.primaryButtonText}>Application under review</Text>
        </View>
        <Text style={styles.dasherNote}>We'll notify you once an admin has reviewed it.</Text>
      </View>
    );
  }

  const locked = !status.verified;
  return (
    <View>
      {status.applicationStatus === 'REJECTED' && (
        <View style={styles.rejectedCard}>
          <Text style={styles.rejectedTitle}>Your last application wasn't approved</Text>
          {!!status.rejectionReason && <Text style={styles.rejectedText}>Reason: {status.rejectionReason}</Text>}
          <Text style={styles.rejectedText}>You can fix this and apply again.</Text>
        </View>
      )}
      <TouchableOpacity
        style={[styles.primaryButton, locked && styles.buttonLocked]}
        onPress={onApply}
        disabled={locked}
        activeOpacity={0.85}
      >
        <Ionicons name="bicycle-outline" size={20} color={locked ? '#8A8A8A' : '#FFFFFF'} style={{ marginRight: 8 }} />
        <Text style={[styles.primaryButtonText, locked && styles.lockedText]}>Become a Dasher</Text>
      </TouchableOpacity>
      {locked && (
        <Text style={styles.dasherNote}>
          <Ionicons name="lock-closed" size={12} color="#3A3A3A" /> You must be verified to apply. Verify your
          CIT-U account above first.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.backgroundSecondary },
  topBar: { height: 64, backgroundColor: COLORS.background, borderBottomWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  topBarTitle: { fontSize: 18, fontWeight: '700', color: COLORS.espresso },
  content: { paddingHorizontal: 16, paddingTop: 32, paddingBottom: 40 },
  avatarSection: { alignItems: 'center', marginBottom: 32 },
  avatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: COLORS.cream, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  name: { fontSize: 20, fontWeight: '700', color: COLORS.espresso, marginBottom: 4 },
  phone: { fontSize: 14, color: COLORS.textSecondary },
  ratingWrap: { marginBottom: 24 },
  verificationSection: { marginBottom: 32 },
  verificationRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  verificationLabel: { fontSize: 14, fontWeight: '500', color: '#3A3A3A' },
  badge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  badgeGold: { backgroundColor: '#F4C600' },
  badgeGray: { backgroundColor: '#E8E8E8' },
  badgeText: { fontSize: 12, fontWeight: '600' },
  badgeTextGold: { color: '#FFFFFF' },
  badgeTextGray: { color: '#3A3A3A' },
  verifyLink: { fontSize: 14, fontWeight: '600', color: COLORS.primary },
  primaryButton: { backgroundColor: COLORS.primary, borderRadius: SIZES.buttonBorderRadius, height: 48, justifyContent: 'center', alignItems: 'center', flexDirection: 'row' },
  primaryButtonText: { fontSize: 16, fontWeight: '600', color: COLORS.white },
  buttonDisabled: { opacity: 0.6 },
  buttonLocked: { backgroundColor: '#E8E8E8' },
  lockedText: { color: '#8A8A8A' },
  dasherNote: { fontSize: 13, color: '#3A3A3A', marginTop: 8, textAlign: 'center' },
  rejectedCard: { backgroundColor: '#FCE8E8', borderRadius: 12, padding: 12, marginBottom: 12 },
  rejectedTitle: { fontSize: 14, fontWeight: '600', color: '#D93025' },
  rejectedText: { fontSize: 13, color: '#3A3A3A', marginTop: 4 },
  outlinedButton: { borderWidth: 1, borderColor: COLORS.primary, borderRadius: SIZES.buttonBorderRadius, height: 48, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', backgroundColor: COLORS.white },
  outlinedButtonText: { fontSize: 16, fontWeight: '600', color: COLORS.primary },
});