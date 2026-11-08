import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Circle } from 'react-native-svg';
import { COLORS, SIZES } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { DeliveryService, DeliveryPersonnelProfile } from '../../services/DeliveryService';

const RING_SIZE = 180;
const RING_STROKE = 14;

/**
 * v2.0 FR-4.3/4.4/4.5 — the dasher's weekly incentive. Below the threshold:
 * a progress ring and the standard rate. Once reached: "Incentive Unlocked!"
 * with the full delivery fee. The count resets every Monday.
 */
export default function IncentiveProgressScreen({ navigation }: any) {
  const { token } = useAuth();
  const [profile, setProfile] = useState<DeliveryPersonnelProfile | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setProfile(await DeliveryService.getMyProfile(token));
      setError(null);
    } catch (e: any) {
      setError(e.message ?? 'Could not load your incentive');
    } finally {
      setRefreshing(false);
    }
  }, [token]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const threshold = profile?.incentiveThreshold ?? 5;
  const done = profile?.weeklyDeliveries ?? 0;
  const unlocked = !!profile?.incentiveActive;
  const standard = peso(profile?.standardFee ?? 10);
  const full = peso(profile?.incentiveFee ?? 15);
  const resets = profile?.incentiveResetsAt ? resetLabel(profile.incentiveResetsAt) : 'every Monday';

  return (
    <SafeAreaView style={[styles.container, unlocked && styles.containerUnlocked]} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.topBarIcon} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Incentive Progress</Text>
        <View style={styles.topBarIcon} />
      </View>

      {!profile ? (
        <View style={styles.center}>
          {error ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator color={COLORS.primary} />}
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.primary} />
          }
        >
          {unlocked ? (
            <View style={styles.unlockedWrap}>
              <Ionicons name="sparkles" size={20} color={COLORS.gold} style={styles.sparkleLeft} />
              <Ionicons name="sparkles" size={14} color={COLORS.gold} style={styles.sparkleRight} />
              <View style={styles.badgeOuter}>
                <View style={styles.badgeInner}>
                  <Ionicons name="checkmark" size={40} color={COLORS.white} />
                </View>
              </View>
              <Text style={styles.unlockedTitle}>Incentive Unlocked!</Text>
              <Text style={styles.unlockedSub}>You now earn the full</Text>
              <Text style={styles.unlockedFee}>{full}</Text>
              <Text style={styles.unlockedSub}>delivery fee with zero commission</Text>

              <View style={styles.goldCard}>
                <Text style={styles.goldCardLabel}>You've completed</Text>
                <Text style={styles.goldCardValue}>
                  {done} deliver{done === 1 ? 'y' : 'ies'}
                </Text>
                <Text style={styles.goldCardNote}>this week. Keep delivering to maximize your earnings!</Text>
              </View>

              <TouchableOpacity style={styles.earningsBtn} onPress={() => navigation.navigate('PaymentCenter')} activeOpacity={0.85}>
                <Text style={styles.earningsBtnText}>View Earnings</Text>
              </TouchableOpacity>
              <Text style={styles.resetNote}>Your count starts again {resets}.</Text>
            </View>
          ) : (
            <View style={styles.lockedWrap}>
              <ProgressRing done={done} total={threshold} />
              <Text style={styles.remaining}>
                {threshold - done} more to unlock the full delivery fee
              </Text>

              <View style={styles.feeCard}>
                <View style={styles.feeIcon}>
                  <Ionicons name="wallet-outline" size={22} color={COLORS.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.feeLabel}>Current Fee Structure</Text>
                  <Text style={styles.feeValue}>{standard} per delivery</Text>
                  <Text style={styles.feeRate}>Standard Rate</Text>
                </View>
              </View>

              <View style={styles.goalBanner}>
                <Text style={styles.goalText}>
                  <Text style={styles.goalBold}>Complete {threshold} deliveries this week</Text> to unlock {full} per
                  delivery with zero commission
                </Text>
              </View>
              <Text style={styles.resetNote}>Your count starts again {resets}.</Text>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

/** Gold ring filling up as this week's deliveries approach the threshold. */
function ProgressRing({ done, total }: { done: number; total: number }) {
  const radius = (RING_SIZE - RING_STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = total > 0 ? Math.min(done / total, 1) : 0;
  return (
    <View style={styles.ring} accessible accessibilityLabel={`${done} of ${total} deliveries this week`}>
      <Svg width={RING_SIZE} height={RING_SIZE}>
        <Circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={radius}
          stroke={COLORS.border}
          strokeWidth={RING_STROKE}
          fill="none"
        />
        <Circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={radius}
          stroke={COLORS.gold}
          strokeWidth={RING_STROKE}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference * (1 - progress)}
          // Start at 12 o'clock and fill clockwise.
          transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
        />
      </Svg>
      <View style={styles.ringCenter}>
        <Text style={styles.ringValue}>{done} / {total}</Text>
        <Text style={styles.ringLabel}>deliveries</Text>
      </View>
    </View>
  );
}

function peso(v: number) {
  return `₱${Number.isInteger(v) ? v : v.toFixed(2)}`;
}

/** "on Monday, Nov 9" for the next reset. */
function resetLabel(iso: string) {
  return `on ${new Date(iso).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.backgroundSecondary },
  containerUnlocked: { backgroundColor: COLORS.background },
  topBar: {
    height: 56,
    backgroundColor: COLORS.background,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  topBarIcon: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  topBarTitle: { flex: 1, fontSize: 16, fontWeight: '600', color: COLORS.text, textAlign: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  error: { color: '#D93025' },
  content: { padding: SIZES.screenPadding, paddingBottom: 40 },

  // Locked
  lockedWrap: { alignItems: 'center', paddingTop: 32 },
  ring: { width: RING_SIZE, height: RING_SIZE, justifyContent: 'center', alignItems: 'center' },
  ringCenter: { position: 'absolute', alignItems: 'center' },
  ringValue: { fontSize: 34, fontWeight: '800', color: COLORS.text },
  ringLabel: { fontSize: SIZES.smallSize, color: COLORS.textSecondary, marginTop: 2 },
  remaining: { fontSize: SIZES.captionSize, color: COLORS.textSecondary, marginTop: 24, marginBottom: 24 },
  feeCard: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: COLORS.white,
    borderRadius: SIZES.cardRadius,
    padding: 16,
    shadowColor: COLORS.espresso,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  feeIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  feeLabel: { fontSize: SIZES.smallSize, color: COLORS.textSecondary },
  feeValue: { fontSize: 18, fontWeight: '800', color: COLORS.primary, marginTop: 2 },
  feeRate: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  goalBanner: {
    alignSelf: 'stretch',
    backgroundColor: COLORS.goldLight,
    borderRadius: SIZES.cardRadius,
    padding: 16,
    marginTop: 16,
  },
  goalText: { fontSize: SIZES.captionSize, color: COLORS.text, textAlign: 'center', lineHeight: 20 },
  goalBold: { fontWeight: '800' },
  resetNote: { fontSize: SIZES.smallSize, color: COLORS.textSecondary, marginTop: 16, textAlign: 'center' },

  // Unlocked
  unlockedWrap: { alignItems: 'center', paddingTop: 32 },
  sparkleLeft: { position: 'absolute', top: 8, left: 24 },
  sparkleRight: { position: 'absolute', top: 40, right: 32 },
  badgeOuter: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: COLORS.goldLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  badgeInner: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: COLORS.gold,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unlockedTitle: { fontSize: 24, fontWeight: '800', color: COLORS.text },
  unlockedSub: { fontSize: SIZES.captionSize, color: COLORS.textSecondary, marginTop: 6 },
  unlockedFee: { fontSize: 32, fontWeight: '800', color: COLORS.primary, marginTop: 6 },
  goldCard: {
    alignSelf: 'stretch',
    backgroundColor: COLORS.goldLight,
    borderRadius: SIZES.cardRadius,
    padding: 18,
    alignItems: 'center',
    marginTop: 28,
  },
  goldCardLabel: { fontSize: SIZES.smallSize, color: COLORS.text },
  goldCardValue: { fontSize: 26, fontWeight: '800', color: COLORS.text, marginTop: 4 },
  goldCardNote: { fontSize: SIZES.smallSize, color: COLORS.text, marginTop: 4, textAlign: 'center' },
  earningsBtn: {
    alignSelf: 'stretch',
    height: SIZES.buttonHeight,
    borderRadius: SIZES.buttonBorderRadius,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  earningsBtnText: { color: COLORS.white, fontSize: SIZES.buttonFontSize, fontWeight: '700' },
});
