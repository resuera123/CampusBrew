import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { showAlert } from './AppAlert';

const MAX_NOTE = 300;

/**
 * "Report a Problem" for a payment or order: a button that opens a short note
 * form, then a "you reported this" banner. The report goes to the admin queue.
 */
export default function ReportProblemCard({
  reported,
  onSubmit,
  placeholder,
  reportedText = 'You reported a problem with this payment.',
}: {
  reported: boolean;
  onSubmit: (note: string) => Promise<void>;
  placeholder: string;
  reportedText?: string;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (reported) {
    return (
      <View style={styles.reportedBanner}>
        <Ionicons name="flag" size={16} color={COLORS.destructive} />
        <Text style={styles.reportedText}>{reportedText} An admin will look into it.</Text>
      </View>
    );
  }

  if (!open) {
    return (
      <TouchableOpacity style={styles.reportBtn} onPress={() => setOpen(true)} activeOpacity={0.7}>
        <Ionicons name="flag-outline" size={18} color={COLORS.destructive} />
        <Text style={styles.reportBtnText}>Report a Problem</Text>
      </TouchableOpacity>
    );
  }

  const submit = async () => {
    if (!note.trim()) {
      showAlert('Add a note', 'Tell us what went wrong.');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(note.trim());
      setOpen(false);
      showAlert('Reported', "Thanks — we'll look into it.");
    } catch (e: any) {
      showAlert('Could not report', e.message || 'Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.label}>What went wrong?</Text>
      <TextInput
        style={styles.noteInput}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textSecondary}
        value={note}
        onChangeText={setNote}
        multiline
        maxLength={MAX_NOTE}
      />
      <Text style={styles.counter}>{note.length}/{MAX_NOTE}</Text>
      <View style={styles.actions}>
        <TouchableOpacity style={[styles.btn, styles.cancelBtn]} onPress={() => setOpen(false)} disabled={submitting}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.submitBtn]} onPress={submit} disabled={submitting}>
          {submitting ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.submitText}>Submit Report</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white, borderRadius: 14, padding: 16, marginBottom: 16,
    borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.border,
  },
  reportedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12,
    backgroundColor: COLORS.destructiveSoft, borderRadius: 10, marginBottom: 16,
  },
  reportedText: { flex: 1, color: COLORS.destructive, fontSize: 13, fontWeight: '600' },
  reportBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderWidth: 1, borderColor: COLORS.destructive, borderRadius: 12, marginBottom: 16,
  },
  reportBtnText: { color: COLORS.destructive, fontWeight: '700', fontSize: 15 },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 8 },
  noteInput: {
    minHeight: 80, fontSize: 14, color: COLORS.text, textAlignVertical: 'top',
    borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.border, borderRadius: 10, padding: 10,
  },
  counter: { fontSize: 11, color: COLORS.textSecondary, textAlign: 'right', marginTop: 4 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  btn: { flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  cancelBtn: { backgroundColor: COLORS.backgroundSecondary },
  cancelText: { color: COLORS.text, fontWeight: '600', fontSize: 15 },
  submitBtn: { backgroundColor: COLORS.primary },
  submitText: { color: COLORS.white, fontWeight: '700', fontSize: 15 },
});
