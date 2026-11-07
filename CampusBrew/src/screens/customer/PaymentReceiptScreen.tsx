import React, { useState } from 'react';
import { View, Text, StyleSheet, StatusBar, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { PaymentCenterService, PaymentCenterEntry, paymentStatusLabel } from '../../services/PaymentCenterService';
import ReportProblemCard from '../../components/ReportProblemCard';

// v2.0 FR-4.8 — receipt + "Report a Problem". Customers report their own GCash
// payments; dashers report a delivery's payment (by its order). The shop
// operator reports from Order History instead.
export default function PaymentReceiptScreen({ navigation, route }: any) {
  const entry: PaymentCenterEntry = route.params?.entry;
  const { token, user } = useAuth();
  const [reported, setReported] = useState(entry?.reported ?? false);

  const isDasherDelivery =
    user?.role === 'DELIVERY_PERSONNEL' && entry?.source === 'TRANSACTION' && !!entry?.orderId;
  const canReport = entry?.source === 'PAYMENT' || isDasherDelivery;

  const submitReport = async (note: string) => {
    if (!token) return;
    if (isDasherDelivery) {
      await PaymentCenterService.reportOrder(entry.orderId!, note, token);
    } else {
      await PaymentCenterService.report(entry.id, note, token);
    }
    setReported(true);
  };

  const Row = ({ label, value }: { label: string; value?: string | null }) =>
    value ? (
      <View style={styles.row}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value}</Text>
      </View>
    ) : null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.topBarIcon}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Receipt</Text>
        <View style={styles.topBarIcon} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View style={styles.amountBlock}>
          <Text style={[styles.amount, entry?.source === 'REFUND' && { color: '#2E7D32' }]}>
            {entry?.source === 'REFUND' ? '+' : ''}₱{entry?.amount?.toFixed(2)}
          </Text>
          <Text style={styles.status}>{entry?.status ? paymentStatusLabel(entry.status) : ''}</Text>
        </View>

        {entry?.source === 'REFUND' && (
          <Text style={styles.refundNote}>
            {entry.status === 'REFUNDED'
              ? 'This order was cancelled and the full amount was sent back to your GCash.'
              : 'This order was cancelled. Your refund is being processed and will go back to your GCash.'}
          </Text>
        )}

        <View style={styles.card}>
          <Row label="Type" value={entry?.description || entry?.kind} />
          <Row label="Method" value={entry?.method} />
          <Row label="Reference No." value={entry?.referenceNo} />
          <Row label="Order" value={entry?.orderId ? `#${entry.orderId.slice(-6).toUpperCase()}` : undefined} />
          <Row label="Date" value={entry?.createdAt ? new Date(entry.createdAt).toLocaleString() : undefined} />
        </View>

        {canReport && (
          <ReportProblemCard
            reported={reported}
            onSubmit={submitReport}
            placeholder={isDasherDelivery
              ? 'e.g. My earnings for this delivery are wrong'
              : 'e.g. I was charged but no order was placed'}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  topBarIcon: { width: 32, height: 32, justifyContent: 'center' },
  topBarTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  amountBlock: { alignItems: 'center', paddingVertical: 20 },
  amount: { fontSize: 34, fontWeight: '800', color: COLORS.text },
  status: { fontSize: 14, fontWeight: '700', color: COLORS.textSecondary, marginTop: 4 },
  card: {
    backgroundColor: COLORS.white, borderRadius: 14, padding: 16, marginBottom: 16,
    borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.border,
  },
  refundNote: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', marginBottom: 16, lineHeight: 19 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  rowLabel: { fontSize: 14, color: COLORS.textSecondary },
  rowValue: { fontSize: 14, fontWeight: '600', color: COLORS.text, maxWidth: '60%', textAlign: 'right' },
});
