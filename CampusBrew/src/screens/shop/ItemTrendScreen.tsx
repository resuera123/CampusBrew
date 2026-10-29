import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { ItemSalesService, ItemTrend } from '../../services/ItemSalesService';

/**
 * v2.0 FR-5.5 — one item's sales trend: daily (this week, Mon–Sun) or weekly (last
 * 8 weeks), this week vs last week, and the shop's best and slowest sellers.
 */
export default function ItemTrendScreen({ route, navigation }: any) {
  const { token } = useAuth();
  const itemId: string = route?.params?.itemId;
  const [period, setPeriod] = useState<'daily' | 'weekly'>('daily');
  const [trend, setTrend] = useState<ItemTrend | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || !itemId) return;
    setLoading(true);
    try {
      setTrend(await ItemSalesService.trend(itemId, period, token));
      setError(null);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load trend');
    } finally {
      setLoading(false);
    }
  }, [token, itemId, period]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.topBarIcon} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle} numberOfLines={1}>{route?.params?.name ?? 'Item Trend'}</Text>
        <View style={styles.topBarIcon} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.rangeRow}>
          {(['daily', 'weekly'] as const).map((p) => (
            <TouchableOpacity
              key={p}
              style={[styles.rangeChip, period === p && styles.rangeChipOn]}
              onPress={() => setPeriod(p)}
            >
              <Text style={[styles.rangeText, period === p && styles.rangeTextOn]}>
                {p === 'daily' ? 'This week' : 'Last 8 weeks'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading && !trend ? (
          <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />
        ) : error || !trend ? (
          <Text style={styles.errorText}>{error ?? 'Something went wrong'}</Text>
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                Units sold · {trend.period === 'daily' ? 'per day this week' : 'per week'}
              </Text>
              <BarChart points={trend.points} />
            </View>

            <View style={styles.card}>
              <SummaryRow label="This week" value={`${trend.thisWeek} units`} bold />
              <SummaryRow label="Last week" value={`${trend.lastWeek} units`} />
              <SummaryRow label="Change" value={formatChange(trend.changePct)} bold />
            </View>

            <View style={styles.card}>
              <Text style={styles.sellerTitle}>Best sellers this week</Text>
              <Text style={styles.sellerText}>
                {trend.bestSellers.length
                  ? trend.bestSellers.map((n, i) => `${i + 1}. ${n}`).join('  ·  ')
                  : 'No sales yet this week'}
              </Text>
              <Text style={[styles.sellerTitle, { marginTop: 10 }]}>Slowest</Text>
              <Text style={styles.sellerText}>{trend.slowest[0] ?? '—'}</Text>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const CHART_HEIGHT = 150;

/**
 * Single-series bar chart: one hue, rounded tops on a recessive baseline, 2px gaps.
 * Only the peak is labeled; tap any bar to read its exact value (the touch
 * equivalent of a hover tooltip).
 */
function BarChart({ points }: { points: { label: string; units: number }[] }) {
  const [selected, setSelected] = useState<number | null>(null);
  const max = Math.max(...points.map((p) => p.units), 0);
  const peak = max > 0 ? points.findIndex((p) => p.units === max) : -1;

  if (max === 0) {
    return <Text style={styles.noSales}>No sales in this period yet.</Text>;
  }

  return (
    <View>
      <View style={styles.chartArea}>
        {points.map((p, i) => {
          const h = Math.max((p.units / max) * CHART_HEIGHT, p.units > 0 ? 3 : 0);
          const showLabel = i === selected || (selected == null && i === peak);
          return (
            <TouchableOpacity
              key={`${p.label}-${i}`}
              style={styles.barSlot}
              activeOpacity={0.8}
              onPress={() => setSelected(i === selected ? null : i)}
              accessibilityLabel={`${p.label}: ${p.units} units`}
            >
              {showLabel && <Text style={styles.barValue}>{p.units}</Text>}
              <View
                style={[
                  styles.bar,
                  { height: h },
                  selected != null && i !== selected && styles.barDimmed,
                ]}
              />
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={styles.axisRow}>
        {points.map((p, i) => (
          <Text key={`${p.label}-${i}`} style={styles.axisLabel} numberOfLines={1}>{p.label}</Text>
        ))}
      </View>
    </View>
  );
}

function SummaryRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, bold && { fontWeight: '700' }]}>{value}</Text>
    </View>
  );
}

function formatChange(pct?: number | null): string {
  if (pct == null) return '—';
  return `${pct > 0 ? '+' : ''}${pct.toFixed(0)}%`;
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
  content: { padding: SIZES.screenPadding, paddingBottom: 32 },
  rangeRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  rangeChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.white },
  rangeChipOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  rangeText: { fontSize: SIZES.captionSize, color: COLORS.text },
  rangeTextOn: { color: COLORS.white, fontWeight: '600' },
  errorText: { color: '#D93025', textAlign: 'center', marginTop: 24 },
  card: { backgroundColor: COLORS.white, borderRadius: 12, padding: 14, marginBottom: 12 },
  cardTitle: { fontSize: SIZES.smallSize, color: COLORS.textSecondary, marginBottom: 12 },
  noSales: { color: COLORS.textSecondary, textAlign: 'center', paddingVertical: 40, fontSize: SIZES.captionSize },
  chartArea: {
    height: CHART_HEIGHT + 20,
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  barSlot: { flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: 1 },
  bar: {
    width: '70%',
    maxWidth: 28,
    backgroundColor: COLORS.primary,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  barDimmed: { opacity: 0.35 },
  barValue: { fontSize: SIZES.smallSize, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  axisRow: { flexDirection: 'row', marginTop: 6 },
  axisLabel: { flex: 1, textAlign: 'center', fontSize: 11, color: COLORS.textSecondary },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  summaryLabel: { fontSize: SIZES.captionSize, color: COLORS.text },
  summaryValue: { fontSize: SIZES.captionSize, color: COLORS.text },
  sellerTitle: { fontSize: SIZES.captionSize, fontWeight: '700', color: COLORS.text },
  sellerText: { fontSize: SIZES.smallSize, color: COLORS.textSecondary, marginTop: 2 },
});
