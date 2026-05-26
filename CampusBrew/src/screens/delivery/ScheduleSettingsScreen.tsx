import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { DeliveryService, DaySchedule, DayOfWeek } from '../../services/DeliveryService';

const DAYS: DayOfWeek[] = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
];

const DAY_LABELS: Record<DayOfWeek, string> = {
  MONDAY: 'Monday',
  TUESDAY: 'Tuesday',
  WEDNESDAY: 'Wednesday',
  THURSDAY: 'Thursday',
  FRIDAY: 'Friday',
  SATURDAY: 'Saturday',
  SUNDAY: 'Sunday',
};

function defaultSchedule(): DaySchedule[] {
  return DAYS.map((d) => ({
    dayOfWeek: d,
    enabled: d !== 'SATURDAY' && d !== 'SUNDAY',
    startTime: '08:00',
    endTime: '17:00',
  }));
}

export default function ScheduleSettingsScreen({ navigation }: any) {
  const { token } = useAuth();
  const [schedule, setSchedule] = useState<DaySchedule[]>(defaultSchedule());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) return;
      try {
        const p = await DeliveryService.getMyProfile(token);
        if (cancelled) return;
        if (p.weeklySchedule && p.weeklySchedule.length > 0) {
          // Merge into the canonical 7-day order so the UI is consistent regardless of stored order.
          const map = new Map(p.weeklySchedule.map((d) => [d.dayOfWeek, d]));
          setSchedule(DAYS.map((d) => map.get(d) ?? {
            dayOfWeek: d,
            enabled: false,
            startTime: '08:00',
            endTime: '17:00',
          }));
        }
      } catch (e: any) {
        setError(e.message || 'Could not load schedule');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const updateDay = (idx: number, patch: Partial<DaySchedule>) => {
    setSchedule((prev) => prev.map((d, i) => (i === idx ? { ...d, ...patch } : d)));
  };

  const handleSave = async () => {
    setError(null);
    if (!token) return;
    setSaving(true);
    try {
      await DeliveryService.updateSchedule(schedule, token);
      navigation.goBack();
    } catch (e: any) {
      setError(e.message || 'Could not save schedule');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.topBarIcon} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Schedule Settings</Text>
        <View style={styles.topBarIcon} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {error && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={18} color="#D93025" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <Text style={styles.hint}>
          Set the hours you're available each day. You can still toggle Active manually any time.
        </Text>

        {schedule.map((d, idx) => (
          <View key={d.dayOfWeek} style={styles.dayCard}>
            <View style={styles.dayHeader}>
              <Text style={styles.dayLabel}>{DAY_LABELS[d.dayOfWeek]}</Text>
              <Switch
                value={d.enabled}
                onValueChange={(v) => updateDay(idx, { enabled: v })}
                trackColor={{ true: COLORS.primary, false: COLORS.border }}
                thumbColor={COLORS.white}
              />
            </View>
            {d.enabled && (
              <View style={styles.timesRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.timeLabel}>Start</Text>
                  <TextInput
                    style={styles.timeInput}
                    value={d.startTime}
                    placeholder="08:00"
                    placeholderTextColor={COLORS.textSecondary}
                    onChangeText={(v) => updateDay(idx, { startTime: v })}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.timeLabel}>End</Text>
                  <TextInput
                    style={styles.timeInput}
                    value={d.endTime}
                    placeholder="17:00"
                    placeholderTextColor={COLORS.textSecondary}
                    onChangeText={(v) => updateDay(idx, { endTime: v })}
                  />
                </View>
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
        {saving
          ? <ActivityIndicator color={COLORS.white} />
          : <Text style={styles.saveBtnText}>Save Schedule</Text>}
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.backgroundSecondary },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.backgroundSecondary },
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
  content: { padding: SIZES.screenPadding, paddingBottom: 32 },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FCE8E8',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  errorText: { color: '#D93025', fontSize: SIZES.smallSize, flex: 1 },
  hint: { fontSize: SIZES.smallSize, color: COLORS.textSecondary, marginBottom: 16 },
  dayCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  dayHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dayLabel: { fontSize: SIZES.bodySize, fontWeight: '600', color: COLORS.text },
  timesRow: { flexDirection: 'row', gap: 12, marginTop: 10 },
  timeLabel: { fontSize: SIZES.smallSize, color: COLORS.textSecondary, marginBottom: 4 },
  timeInput: {
    height: SIZES.inputHeight,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: SIZES.inputBorderRadius,
    paddingHorizontal: 12,
    fontSize: SIZES.inputFontSize,
    color: COLORS.text,
    backgroundColor: COLORS.white,
  },
  saveBtn: {
    margin: SIZES.screenPadding,
    height: SIZES.buttonHeight,
    backgroundColor: COLORS.primary,
    borderRadius: SIZES.buttonBorderRadius,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveBtnText: { color: COLORS.white, fontSize: SIZES.buttonFontSize, fontWeight: '600' },
});
