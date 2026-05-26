import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { COLORS, SIZES } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { DeliveryService } from '../../services/DeliveryService';

interface DeliveryOffer {
  orderId: string;
  shopName?: string;
  shopLocation?: string;
  deliveryLocation?: string;
  orderAmount?: number;
  itemCount?: number;
  timeoutSeconds?: number;
}

/**
 * Renders as an overlay anywhere the DELIVERY_PERSONNEL is in the app. Listens
 * for `delivery:request` socket events and surfaces accept/decline with a
 * server-driven countdown. The backend's ScheduledExecutorService handles the
 * authoritative timeout — this UI just mirrors it visually.
 */
export default function IncomingOrderModal() {
  const { token, user } = useAuth();
  const { socket } = useSocket();
  const navigation = useNavigation<any>();
  const [offer, setOffer] = useState<DeliveryOffer | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(60);
  const [submitting, setSubmitting] = useState(false);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Only render the modal for delivery personnel.
  const isDP = user?.role === 'DELIVERY_PERSONNEL';

  useEffect(() => {
    if (!socket || !isDP) return;

    const onRequest = (payload: DeliveryOffer) => {
      setOffer(payload);
      setSecondsLeft(payload.timeoutSeconds ?? 60);
    };

    const onAssigned = () => {
      // Backend confirmed assignment to this DP — close the modal and route to
      // the assigned-delivery flow. navigate() is a no-op if the route isn't
      // mounted on the current stack.
      setOffer(null);
      try { navigation.navigate('AssignedDelivery'); } catch { /* not on a delivery stack */ }
    };

    const onClaimed = (payload: { orderId?: string }) => {
      // Another DP got there first — close the modal if it's showing this order.
      setOffer((current) => (current && current.orderId === payload?.orderId ? null : current));
    };

    socket.on('delivery:request', onRequest);
    socket.on('order:assigned', onAssigned);
    socket.on('delivery:claimed', onClaimed);

    return () => {
      socket.off('delivery:request', onRequest);
      socket.off('order:assigned', onAssigned);
      socket.off('delivery:claimed', onClaimed);
    };
  }, [socket, isDP, navigation]);

  // Countdown ticker.
  useEffect(() => {
    if (!offer) {
      if (tickRef.current) clearInterval(tickRef.current);
      tickRef.current = null;
      return;
    }
    tickRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          // Server will fire its own timeout; we just close the UI when ours hits zero.
          if (tickRef.current) clearInterval(tickRef.current);
          setOffer(null);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [offer]);

  const handleAccept = async () => {
    if (!offer || !token) return;
    setSubmitting(true);
    try {
      await DeliveryService.acceptAssignment(offer.orderId, token);
      // Close optimistically — the `order:assigned` socket event will navigate.
      setOffer(null);
    } catch (e: any) {
      Alert.alert('Could not accept', e.message || 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDecline = async () => {
    if (!offer || !token) return;
    setSubmitting(true);
    try {
      await DeliveryService.declineAssignment(offer.orderId, token);
      setOffer(null);
    } catch (e: any) {
      Alert.alert('Could not decline', e.message || 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isDP || !offer) return null;

  const tone = countdownTone(secondsLeft);

  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="pageSheet"
      transparent={false}
      onRequestClose={() => {}}
    >
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <View style={styles.topBarIcon}>
            <Ionicons name="bicycle-outline" size={22} color={COLORS.primary} />
          </View>
          <Text style={styles.topBarTitle}>New Delivery Request</Text>
          <View style={styles.topBarIcon} />
        </View>

        <View style={styles.body}>
          <View style={styles.card}>
            <Row label="Pickup">
              <Text style={styles.value} numberOfLines={2}>
                {offer.shopName || 'Shop'}{offer.shopLocation ? ` · ${offer.shopLocation}` : ''}
              </Text>
            </Row>
            <Row label="Drop-off">
              <Text style={styles.value} numberOfLines={2}>{offer.deliveryLocation || '—'}</Text>
            </Row>
            <Row label="Order">
              <Text style={styles.value}>
                {offer.itemCount ?? '—'} item{(offer.itemCount ?? 0) !== 1 ? 's' : ''} · ₱{(offer.orderAmount ?? 0).toFixed(2)}
              </Text>
            </Row>
          </View>

          <View style={[styles.countdownBox, { backgroundColor: tone.bg }]}>
            <Text style={[styles.countdownLabel, { color: tone.fg }]}>Time to respond</Text>
            <Text style={[styles.countdownValue, { color: tone.fg }]}>
              {String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:
              {String(secondsLeft % 60).padStart(2, '0')}
            </Text>
            <Text style={[styles.countdownHint, { color: tone.fg }]}>
              {tone.label}
            </Text>
          </View>

          <View style={{ flex: 1 }} />

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.btn, styles.btnSecondary]}
              onPress={handleDecline}
              disabled={submitting}
            >
              <Text style={styles.btnSecondaryText}>Decline</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.btnPrimary]}
              onPress={handleAccept}
              disabled={submitting}
            >
              {submitting
                ? <ActivityIndicator color={COLORS.white} />
                : <Text style={styles.btnPrimaryText}>Accept</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

/** Color stages: green ≥40s, orange ≥20s, red <20s. */
function countdownTone(secondsLeft: number): { bg: string; fg: string; label: string } {
  if (secondsLeft >= 40) {
    return { bg: '#E6F4EA', fg: '#1E8E3E', label: 'Take your time — plenty left to respond.' };
  }
  if (secondsLeft >= 20) {
    return { bg: '#FFF1D6', fg: '#9A5800', label: 'Heads up — time is running out.' };
  }
  return { bg: '#FCE8E8', fg: '#B11212', label: 'Hurry — about to be released.' };
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
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
  body: { flex: 1, padding: SIZES.screenPadding },
  card: { backgroundColor: COLORS.white, borderRadius: 12, padding: 16, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8 },
  rowLabel: {
    width: 80,
    fontSize: SIZES.smallSize,
    color: COLORS.textSecondary,
    paddingTop: 2,
  },
  value: { fontSize: SIZES.captionSize, color: COLORS.text },
  countdownBox: {
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
  },
  countdownLabel: { fontSize: SIZES.smallSize, fontWeight: '600' },
  countdownValue: { fontSize: 40, fontWeight: '800', marginTop: 4 },
  countdownHint: { fontSize: SIZES.smallSize, marginTop: 4 },
  actions: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  btn: {
    flex: 1,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnPrimary: { backgroundColor: COLORS.primary },
  btnPrimaryText: { color: COLORS.white, fontWeight: '700', fontSize: SIZES.buttonFontSize },
  btnSecondary: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.primary },
  btnSecondaryText: { color: COLORS.primary, fontWeight: '700', fontSize: SIZES.buttonFontSize },
});
