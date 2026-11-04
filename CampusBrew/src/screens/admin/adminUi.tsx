import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput, Modal, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES } from '../../constants/theme';

/** Small pieces shared by the admin screens. */

export function FilterTabs<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.tabs}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <TouchableOpacity key={o.value} style={[styles.tab, on && styles.tabOn]} onPress={() => onChange(o.value)}>
            <Text style={[styles.tabText, on && styles.tabTextOn]}>{o.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const CHIP: Record<string, { bg: string; fg: string; label: string }> = {
  PENDING: { bg: '#FFF4D6', fg: '#8A6100', label: 'Pending' },
  APPROVED: { bg: '#E6F4EA', fg: '#1E8E3E', label: 'Approved' },
  REJECTED: { bg: '#FCE8E8', fg: '#D93025', label: 'Rejected' },
  OPEN: { bg: '#FCE8E8', fg: '#D93025', label: 'Open' },
  RESOLVED: { bg: '#E6F4EA', fg: '#1E8E3E', label: 'Resolved' },
  SUSPENDED: { bg: '#FCE8E8', fg: '#D93025', label: 'Suspended' },
};

export function StatusChip({ status }: { status: string }) {
  const c = CHIP[status] ?? { bg: COLORS.backgroundSecondary, fg: COLORS.textSecondary, label: status };
  return (
    <View style={[styles.chip, { backgroundColor: c.bg }]}>
      <Text style={[styles.chipText, { color: c.fg }]}>{c.label}</Text>
    </View>
  );
}

export function InfoRow({ icon, label, value }: { icon: any; label: string; value?: string | null }) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={16} color={COLORS.primary} style={{ marginTop: 2 }} />
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value || '—'}</Text>
      </View>
    </View>
  );
}

/** Short reference shown to the admin (RPT-0004); older records fall back to the id's tail. */
export function refOf(item: { id: string; ref?: string | null }) {
  return item.ref || `#${item.id.slice(-6).toUpperCase()}`;
}

/** True when every word of the query appears in one of the fields. */
export function matches(query: string, ...fields: (string | null | undefined)[]) {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = fields.filter(Boolean).join(' ').toLowerCase();
  return words.every((w) => haystack.includes(w));
}

export function SearchBar({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <View style={styles.searchWrap}>
      <View style={styles.search}>
        <Ionicons name="search" size={16} color={COLORS.textSecondary} />
        <TextInput
          style={styles.searchInput}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={COLORS.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {!!value && (
          <TouchableOpacity onPress={() => onChange('')} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={COLORS.textSecondary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

export function RefTag({ value }: { value: string }) {
  return <Text style={styles.ref}>{value}</Text>;
}

export function ReappliedBadge() {
  return (
    <View style={styles.reapplied}>
      <Ionicons name="refresh" size={11} color="#1F4F9A" />
      <Text style={styles.reappliedText}>Re-Applied</Text>
    </View>
  );
}

/**
 * A styled dialog that asks for a reason (rejecting, suspending). With
 * `required`, the confirm button stays disabled until something is typed.
 */
export function ReasonDialog({
  visible,
  title,
  message,
  label,
  placeholder,
  confirmLabel,
  icon = 'ban-outline',
  required = false,
  initialValue = '',
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  title: string;
  message?: string;
  label: string;
  placeholder?: string;
  confirmLabel: string;
  icon?: any;
  required?: boolean;
  initialValue?: string;
  onCancel: () => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState(initialValue);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) {
      setReason(initialValue);
      setBusy(false);
    }
  }, [visible, initialValue]);

  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm(reason.trim());
    } finally {
      setBusy(false);
    }
  };

  const blocked = busy || (required && !reason.trim());
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => !busy && onCancel()}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.sheet}>
          <View style={styles.sheetIcon}>
            <Ionicons name={icon} size={26} color="#D93025" />
          </View>
          <Text style={styles.sheetTitle}>{title}</Text>
          {!!message && <Text style={styles.sheetMessage}>{message}</Text>}
          <Text style={styles.sheetLabel}>{label}</Text>
          <TextInput
            style={styles.reasonInput}
            value={reason}
            onChangeText={setReason}
            placeholder={placeholder}
            placeholderTextColor={COLORS.textSecondary}
            multiline
            maxLength={300}
            textAlignVertical="top"
          />
          <View style={styles.sheetButtons}>
            <TouchableOpacity style={[styles.sheetBtn, styles.sheetCancel]} onPress={onCancel} disabled={busy}>
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sheetBtn, styles.sheetDanger, blocked && { opacity: 0.45 }]}
              onPress={confirm}
              disabled={blocked}
            >
              {busy ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.sheetDangerText}>{confirmLabel}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function formatDate(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: SIZES.screenPadding,
    paddingVertical: 10,
    backgroundColor: COLORS.background,
    borderBottomWidth: 0,
  },
  tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, backgroundColor: COLORS.backgroundSecondary },
  tabOn: { backgroundColor: COLORS.primary },
  tabText: { fontSize: SIZES.smallSize, color: COLORS.text, fontWeight: '600' },
  tabTextOn: { color: COLORS.white },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14 },
  chipText: { fontSize: 11, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 10, paddingVertical: 8 },
  rowLabel: { fontSize: SIZES.smallSize, color: COLORS.textSecondary },
  rowValue: { fontSize: SIZES.captionSize, color: COLORS.text, marginTop: 1 },
  searchWrap: { backgroundColor: COLORS.background, paddingHorizontal: SIZES.screenPadding, paddingBottom: 10 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: COLORS.backgroundSecondary,
  },
  searchInput: { flex: 1, fontSize: SIZES.captionSize, color: COLORS.text, paddingVertical: 0 },
  ref: {
    alignSelf: 'flex-start',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
    color: COLORS.primary,
    backgroundColor: '#F6E9EA',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 4,
  },
  reapplied: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#E4ECFB',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  reappliedText: { fontSize: 11, fontWeight: '700', color: '#1F4F9A' },
  backdrop: { flex: 1, backgroundColor: 'rgba(36,23,25,0.55)', justifyContent: 'center', padding: 24 },
  sheet: { backgroundColor: COLORS.white, borderRadius: 20, padding: 20 },
  sheetIcon: {
    alignSelf: 'center',
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FCE8E8',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text, textAlign: 'center' },
  sheetMessage: { fontSize: SIZES.captionSize, color: COLORS.textSecondary, textAlign: 'center', marginTop: 6, lineHeight: 19 },
  sheetLabel: { fontSize: SIZES.smallSize, fontWeight: '600', color: COLORS.text, marginTop: 16, marginBottom: 6 },
  reasonInput: {
    minHeight: 84,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 10,
    fontSize: SIZES.captionSize,
    color: COLORS.text,
  },
  sheetButtons: { flexDirection: 'row', gap: 10, marginTop: 16 },
  sheetBtn: { flex: 1, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  sheetCancel: { borderWidth: 1, borderColor: COLORS.border },
  sheetCancelText: { color: COLORS.text, fontWeight: '600' },
  sheetDanger: { backgroundColor: '#D93025' },
  sheetDangerText: { color: COLORS.white, fontWeight: '700' },
});
