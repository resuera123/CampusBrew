import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
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
});
