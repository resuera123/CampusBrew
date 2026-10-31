import React, { useState } from 'react';
import {
  View, Text, StyleSheet, StatusBar, TouchableOpacity, ScrollView, TextInput, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { PaymentCenterService, PaymentCenterEntry } from '../../services/PaymentCenterService';
import { showAlert } from '../../components/AppAlert';

// v2.0 FR-4.8 — receipt + "Report a Problem" (payments only).
export default function PaymentReceiptScreen({ navigation, route }: any) {
  const entry: PaymentCenterEntry = route.params?.entry;
  const { token } = useAuth();
  const [reporting, setReporting] = useState(false);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [reported, setReported] = useState(entry?.reported ?? false);

  const canReport = entry?.source === 'PAYMENT' && !reported;

  const submitReport = async () => {
    if (!token || !note.trim()) {
      showAlert('Add a note', 'Tell us what went wrong with this payment.');
      return;
    }
    setSubmitting(true);
    try {
      await PaymentCenterService.report(entry.id, note.trim(), token);
      setReported(true);
      setReporting(false);
      showAlert('Reported', 'Thanks — we\'ll look into this payment.');
    } catch (e: any) {
      showAlert('Could not report', e.message || 'Try again.');
    } finally {
      setSubmitting(false);
    }
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
          <Text style={styles.amount}>₱{entry?.amount?.toFixed(2)}</Text>
          <Text style={styles.status}>{entry?.status}</Text>
        </View>

        <View style={styles.card}>
          <Row label="Type" value={entry?.description || entry?.kind} />
          <Row label="Method" value={entry?.method} />
          <Row label="Reference No." value={entry?.referenceNo} />
          <Row label="Order" value={entry?.orderId} />
          <Row label="Date" value={entry?.createdAt ? new Date(entry.createdAt).toLocaleString() : undefined} />
        </View>

        {reported && (
          <View style={styles.reportedBanner}>
            <Ionicons name="flag" size={16} color="#C0392B" />
            <Text style={styles.reportedText}>You reported a problem with this payment.</Text>
          </View>
        )}

        {canReport && !reporting && (
          <TouchableOpacity style={styles.reportBtn} onPress={() => setReporting(true)} activeOpacity={0.7}>
            <Ionicons name="flag-outline" size={18} color="#C0392B" />
            <Text style={styles.reportBtnText}>Report a Problem</Text>
          </TouchableOpacity>
        )}

        {reporting && (
          <View style={styles.card}>
            <Text style={styles.reportLabel}>What went wrong?</Text>
            <TextInput
              style={styles.noteInput}
              placeholder="e.g. I was charged but no order was placed"
              placeholderTextColor={COLORS.textSecondary}
              value={note}
              onChangeText={setNote}
              multiline
              maxLength={300}
            />
            <TouchableOpacity style={styles.submitBtn} onPress={submitReport} disabled={submitting}>
              {submitting ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.submitText}>Submit Report</Text>}
            </TouchableOpacity>
          </View>
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
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  rowLabel: { fontSize: 14, color: COLORS.textSecondary },
  rowValue: { fontSize: 14, fontWeight: '600', color: COLORS.text, maxWidth: '60%', textAlign: 'right' },
  reportedBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, backgroundColor: '#FDEDEC', borderRadius: 10, marginBottom: 16 },
  reportedText: { color: '#C0392B', fontSize: 13, fontWeight: '600' },
  reportBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderWidth: 1, borderColor: '#C0392B', borderRadius: 12 },
  reportBtnText: { color: '#C0392B', fontWeight: '700', fontSize: 15 },
  reportLabel: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 8 },
  noteInput: { minHeight: 70, fontSize: 14, color: COLORS.text, textAlignVertical: 'top', borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.border, borderRadius: 10, padding: 10 },
  submitBtn: { backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 12 },
  submitText: { color: COLORS.white, fontWeight: '700', fontSize: 15 },
});
