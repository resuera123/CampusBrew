import React, { useState } from 'react';
import {
  View, Text, StyleSheet, StatusBar, TouchableOpacity, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { DeliveryService } from '../../services/DeliveryService';

// v2.0 FR-3.1 — how far from the shop the dasher will accept first offers.
// null = campus default (no range cap); the 60s re-broadcast ignores range anyway.
const OPTIONS: { label: string; sub: string; meters: number | null }[] = [
  { label: 'Campus default', sub: 'Get every nearby offer first', meters: null },
  { label: '200 m', sub: 'Only very close shops', meters: 200 },
  { label: '400 m', sub: 'A short walk', meters: 400 },
  { label: '600 m', sub: 'Across campus', meters: 600 },
  { label: '1 km', sub: 'Campus-wide', meters: 1000 },
];

export default function PickupRangeScreen({ navigation, route }: any) {
  const { token } = useAuth();
  const [selected, setSelected] = useState<number | null>(route.params?.current ?? null);
  const [saving, setSaving] = useState(false);

  const save = async (meters: number | null) => {
    if (!token) return;
    setSelected(meters);
    setSaving(true);
    try {
      await DeliveryService.updatePickupRange(meters, token);
      route.params?.onSaved?.(meters);
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Could not save', e.message || 'Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.topBarIcon}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Pickup Range</Text>
        <View style={styles.topBarIcon} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={styles.intro}>
          You'll be offered orders from shops within this range first. If nobody takes an order,
          it's re-broadcast to all active dashers regardless of range.
        </Text>

        {OPTIONS.map((opt) => {
          const isSel = selected === opt.meters;
          return (
            <TouchableOpacity
              key={opt.label}
              style={[styles.row, isSel && styles.rowSelected]}
              onPress={() => !saving && save(opt.meters)}
              activeOpacity={0.7}
              disabled={saving}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>{opt.label}</Text>
                <Text style={styles.rowSub}>{opt.sub}</Text>
              </View>
              {saving && isSel ? (
                <ActivityIndicator color={COLORS.primary} />
              ) : (
                <Ionicons
                  name={isSel ? 'radio-button-on' : 'radio-button-off'}
                  size={22}
                  color={isSel ? COLORS.primary : COLORS.border}
                />
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  topBarIcon: { width: 32, height: 32, justifyContent: 'center' },
  topBarTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  intro: { fontSize: 13.5, color: COLORS.textSecondary, lineHeight: 19, marginBottom: 16 },
  row: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white,
    borderRadius: 12, padding: 16, marginBottom: 10,
    borderWidth: 1, borderColor: COLORS.border,
  },
  rowSelected: { borderColor: COLORS.primary },
  rowLabel: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  rowSub: { fontSize: 12.5, color: COLORS.textSecondary, marginTop: 2 },
});
