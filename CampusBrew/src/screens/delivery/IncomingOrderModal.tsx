import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { DeliveryService } from '../../services/DeliveryService';
import { navigate } from '../../navigation/navigationRef';
import { showAlert } from '../../components/AppAlert';

interface DeliveryOffer {
  orderId: string;
  shopName?: string;
  shopLocation?: string;
  dropoff?: string;
  itemCount?: number;
  // v2.0 FR-3.2 — richer offer payload
  beverageCost?: number;
  paidViaGcash?: boolean;
  amountToCollect?: number | null;
  tip?: number;
  earnings?: number;
  customerRating?: number | null;
  distanceMeters?: number | null;
  incentiveProgress?: string;
  timeoutSeconds?: number;
  expiresAt?: number;
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
  const [offer, setOffer] = useState<DeliveryOffer | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(60);
  const [submitting, setSubmitting] = useState(false);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Only render the modal for delivery personnel.
  const isDP = user?.role === 'DELIVERY_PERSONNEL';

  // The offer on screen (for the catch-up check, which runs outside React state),
  // and offers this dasher already closed: orderId -> that offer's expiresAt, so
  // the catch-up doesn't bring back one they declined or let run out.
  const offerRef = useRef<DeliveryOffer | null>(null);
  const closed = useRef(new Map<string, number>());
  useEffect(() => { offerRef.current = offer; }, [offer]);

  const closeOffer = (o: DeliveryOffer | null) => {
    if (o) closed.current.set(o.orderId, o.expiresAt ?? Date.now());
    setOffer(null);
  };

  /**
   * Catch-up: asks the server for offers still open for this dasher and shows
   * the first one. Covers a delivery:request missed while the socket was down or
   * the app was in the background. Runs on every (re)connect, on return to the
   * foreground, and every 20s while the app is open.
   */
  const checkOpenOffers = useCallback(async () => {
    if (!token || !isDP || offerRef.current) return;
    try {
      const offers: DeliveryOffer[] = await DeliveryService.getOpenOffers(token);
      if (offerRef.current) return;
      const next = offers.find((o) => {
        const seen = closed.current.get(o.orderId);
        // A re-broadcast gets a later expiresAt, so it shows again; the same offer doesn't.
        return seen == null || (o.expiresAt ?? 0) > seen + 5000;
      });
      if (next) {
        setOffer(next);
        setSecondsLeft(next.timeoutSeconds ?? 60);
      }
    } catch {
      // Offline or server asleep — the next check or the live event will catch it.
    }
  }, [token, isDP]);

  useEffect(() => {
    if (!socket || !isDP) return;

    const onRequest = (payload: DeliveryOffer) => {
      setOffer(payload);
      setSecondsLeft(payload.timeoutSeconds ?? 60);
    };

    const onClaimed = (payload: { orderId?: string }) => {
      // Another DP got there first — close the modal if it's showing this order.
      if (payload?.orderId) closed.current.set(payload.orderId, Number.MAX_SAFE_INTEGER);
      setOffer((current) => (current && current.orderId === payload?.orderId ? null : current));
    };

    socket.on('delivery:request', onRequest);
    socket.on('delivery:claimed', onClaimed);
    socket.on('connect', checkOpenOffers);

    return () => {
      socket.off('delivery:request', onRequest);
      socket.off('delivery:claimed', onClaimed);
      socket.off('connect', checkOpenOffers);
    };
  }, [socket, isDP, checkOpenOffers]);

  // Return to the foreground, plus a backup check every 20s while the app is open.
  useEffect(() => {
    if (!isDP) return;
    checkOpenOffers();
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') checkOpenOffers(); });
    const t = setInterval(() => {
      if (AppState.currentState === 'active') checkOpenOffers();
    }, 20000);
    return () => { sub.remove(); clearInterval(t); };
  }, [isDP, checkOpenOffers]);

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
          closeOffer(offerRef.current);
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
      // NFR-P8 — go straight to the claimed order. (The server's `order:assigned`
      // event goes to the customer and shop only, so waiting for it left the
      // dasher on whatever screen they were on.)
      closeOffer(offer);
      navigate('AssignedDelivery');
    } catch (e: any) {
      showAlert('Could not accept', e.message || 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDecline = async () => {
    if (!offer || !token) return;
    setSubmitting(true);
    try {
      await DeliveryService.declineAssignment(offer.orderId, token);
      closeOffer(offer);
    } catch (e: any) {
      showAlert('Could not decline', e.message || 'Please try again.');
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
                {offer.distanceMeters != null ? `  ·  ${Math.round(offer.distanceMeters)} m away` : ''}
              </Text>
            </Row>
            <Row label="Drop-off">
              <Text style={styles.value} numberOfLines={2}>
                {offer.dropoff || '—'}
                {offer.customerRating != null ? `   ★ ${offer.customerRating.toFixed(1)}` : ''}
              </Text>
            </Row>
            <Row label="Pay the shop">
              <Text style={styles.value}>₱{(offer.beverageCost ?? 0).toFixed(2)}</Text>
            </Row>
            <Row label="Collect">
              <Text style={styles.value}>
                {offer.paidViaGcash
                  ? 'Paid via GCash ✓'
                  : `₱${(offer.amountToCollect ?? 0).toFixed(2)}`}
              </Text>
            </Row>
            <Row label="Your earnings">
              <Text style={[styles.value, styles.earnings]}>
                ₱{(offer.earnings ?? 0).toFixed(2)}
                {offer.incentiveProgress ? `   ·   ${offer.incentiveProgress} to full fee` : ''}
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
  earnings: { fontWeight: '700', color: COLORS.primary },
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
