import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  LayoutChangeEvent,
  GestureResponderEvent,
} from 'react-native';
import Svg, { Path, Line, Circle } from 'react-native-svg';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SIZES } from '../constants/theme';
import { useSocket } from '../context/SocketContext';
import { ItemSalesService, SalesChart, SalesSeries } from '../services/ItemSalesService';

/**
 * v2.0 FR-5.5 — the shop dashboard's all-items sales chart: one line per item,
 * units sold per day (last 7 days) or per week (last 4 weeks).
 *
 * The 5 best sellers start switched on; legend chips toggle items, up to 8 at a
 * time (the validated categorical palette has 8 slots). An item takes the lowest
 * free color slot when switched on and keeps it while others toggle or the range
 * changes, so color follows the item, never its rank. Tapping the plot shows that
 * day's values (the touch stand-in for a hover tooltip). Chip names and totals
 * double as labels, which the lighter slots need (below 3:1 on white).
 */

// Reference categorical palette, fixed order (validated: CVD adjacent ΔE ≥ 9.1).
const SERIES_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];
const MAX_ON = SERIES_COLORS.length;
const DEFAULT_ON = 5;
const CHIP_PREVIEW = 12;

const PLOT_HEIGHT = 170;
// left/right leave room for the half-width of the first/last x label (40px wide).
const PAD = { left: 30, right: 20, top: 10, bottom: 22 };

type Range = '7d' | '4w';

export default function SalesByItemChart({ token, onOpenDetails }: { token: string | null; onOpenDetails: () => void }) {
  const { socket } = useSocket();
  const [range, setRange] = useState<Range>('7d');
  const [data, setData] = useState<SalesChart | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [slots, setSlots] = useState<Record<string, number> | null>(null); // itemId -> color slot
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showAllChips, setShowAllChips] = useState(false);
  const [width, setWidth] = useState(0);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const chart = await ItemSalesService.chart(range, token);
      setData(chart);
      setError(null);
      // First load: switch on the best sellers.
      setSlots((prev) => prev ?? Object.fromEntries(
        chart.series.slice(0, DEFAULT_ON).map((s, i) => [s.itemId, i]),
      ));
    } catch (e: any) {
      setError(e.message ?? 'Failed to load the sales chart');
    }
  }, [token, range]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => { setSelectedIdx(null); }, [range]);

  // New sales only arrive with a delivered order.
  useEffect(() => {
    if (!socket) return;
    const refresh = () => load();
    socket.on('order:delivered', refresh);
    return () => socket.off('order:delivered', refresh);
  }, [socket, load]);

  const toggle = (itemId: string) => {
    const next = { ...(slots ?? {}) };
    if (itemId in next) {
      delete next[itemId];
    } else {
      const used = new Set(Object.values(next));
      if (used.size >= MAX_ON) {
        setNotice(`Up to ${MAX_ON} items at a time — switch one off first.`);
        return;
      }
      let slot = 0;
      while (used.has(slot)) slot++; // lowest free color slot
      next[itemId] = slot;
    }
    setNotice(null);
    setSlots(next);
  };

  const visible = useMemo(
    () => (data && slots ? data.series.filter((s) => s.itemId in slots) : []),
    [data, slots],
  );
  const n = data?.labels.length ?? 0;
  const plotW = Math.max(width - PAD.left - PAD.right, 1);
  const peak = Math.max(0, ...visible.flatMap((s) => s.units));
  const { yMax, step } = niceScale(peak);
  const x = (i: number) => PAD.left + (n <= 1 ? plotW / 2 : (i * plotW) / (n - 1));
  const y = (v: number) => PAD.top + PLOT_HEIGHT - (v / yMax) * PLOT_HEIGHT;

  const onTouch = (e: GestureResponderEvent) => {
    if (n === 0) return;
    const px = e.nativeEvent.locationX - PAD.left;
    const idx = Math.round(n <= 1 ? 0 : (px / plotW) * (n - 1));
    setSelectedIdx(Math.min(Math.max(idx, 0), n - 1));
  };

  const header = (
    <View style={styles.headerRow}>
      <Text style={styles.title}>Sales by item</Text>
      <View style={styles.rangeRow}>
        {(['7d', '4w'] as Range[]).map((r) => (
          <TouchableOpacity key={r} style={[styles.rangeChip, range === r && styles.rangeChipOn]} onPress={() => setRange(r)}>
            <Text style={[styles.rangeText, range === r && styles.rangeTextOn]}>{r === '7d' ? '7 days' : '4 weeks'}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  if (!data) {
    return (
      <View style={styles.card}>
        {header}
        {error ? <Text style={styles.errorText}>{error}</Text> : <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 40 }} />}
      </View>
    );
  }

  if (data.series.length === 0) {
    return (
      <View style={styles.card}>
        {header}
        <Text style={styles.emptyText}>Add menu items to see sales by item.</Text>
      </View>
    );
  }

  const chips = showAllChips ? data.series : data.series.slice(0, CHIP_PREVIEW);
  const readout = selectedIdx == null ? null
    : [...visible].sort((a, b) => b.units[selectedIdx] - a.units[selectedIdx]);

  return (
    <View style={styles.card}>
      {header}
      <Text style={styles.subtitle}>Units sold per {range === '7d' ? 'day' : 'week'}</Text>

      <View
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onResponderGrant={onTouch}
        onResponderMove={onTouch}
        onResponderTerminationRequest={() => true}
        accessible
        accessibilityLabel={`Units sold per ${range === '7d' ? 'day, last 7 days' : 'week, last 4 weeks'}. `
          + visible.map((s) => `${s.name} ${s.total}`).join(', ')}
      >
        {width > 0 && (
          <Svg width={width} height={PLOT_HEIGHT + PAD.top + PAD.bottom}>
            {/* Recessive grid: four steps up from a zero baseline. */}
            {[0, 1, 2, 3, 4].map((k) => (
              <Line
                key={k}
                x1={PAD.left} x2={width - PAD.right}
                y1={y(k * step)} y2={y(k * step)}
                stroke={k === 0 ? '#CFCFCF' : '#EFEFEF'} strokeWidth={1}
              />
            ))}
            {selectedIdx != null && (
              <Line x1={x(selectedIdx)} x2={x(selectedIdx)} y1={PAD.top} y2={y(0)} stroke="#BDBDBD" strokeWidth={1} />
            )}
            {visible.map((s) => (
              <Path
                key={s.itemId}
                d={s.units.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(v)}`).join(' ')}
                stroke={SERIES_COLORS[slots![s.itemId]]}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                fill="none"
              />
            ))}
            {selectedIdx != null && visible.map((s) => (
              <Circle
                key={`dot-${s.itemId}`}
                cx={x(selectedIdx)} cy={y(s.units[selectedIdx])} r={4}
                fill={SERIES_COLORS[slots![s.itemId]]} stroke={COLORS.white} strokeWidth={2}
              />
            ))}
          </Svg>
        )}
        {/* Axis labels as Text so they use the app's font and text colors. */}
        {width > 0 && [0, 2, 4].map((k) => (
          <Text key={`y-${k}`} style={[styles.axisText, styles.yLabel, { top: y(k * step) - 7 }]}>{k * step}</Text>
        ))}
        <View style={[styles.xLabels, { left: PAD.left - 20, right: PAD.right - 20 }]}>
          {data.labels.map((l, i) => (
            <Text key={`${l}-${i}`} style={[styles.axisText, styles.xLabel, selectedIdx === i && styles.axisTextOn]} numberOfLines={1}>{l}</Text>
          ))}
        </View>
        {peak === 0 && (
          <View style={styles.noSalesOverlay} pointerEvents="none">
            <Text style={styles.noSalesText}>
              {visible.length === 0 ? 'Switch items on below.' : 'No sales in this period yet.'}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.readout}>
        {readout == null ? (
          <Text style={styles.readoutHint}>Tap the chart to see each item's units.</Text>
        ) : (
          <>
            <Text style={styles.readoutTitle}>{data.labels[selectedIdx!]}</Text>
            {readout.map((s) => (
              <View key={s.itemId} style={styles.readoutRow}>
                <View style={[styles.swatch, { backgroundColor: SERIES_COLORS[slots![s.itemId]] }]} />
                <Text style={styles.readoutName} numberOfLines={1}>{s.name}</Text>
                <Text style={styles.readoutValue}>{s.units[selectedIdx!]}</Text>
              </View>
            ))}
          </>
        )}
      </View>

      <Text style={styles.legendHint}>
        {Object.keys(slots ?? {}).length}/{MAX_ON} shown · tap an item to show or hide it
      </Text>
      <View style={styles.chips}>
        {chips.map((s) => (
          <LegendChip
            key={s.itemId}
            series={s}
            color={slots && s.itemId in slots ? SERIES_COLORS[slots[s.itemId]] : null}
            onPress={() => toggle(s.itemId)}
          />
        ))}
        {data.series.length > CHIP_PREVIEW && (
          <TouchableOpacity style={styles.moreChip} onPress={() => setShowAllChips((v) => !v)}>
            <Text style={styles.moreText}>{showAllChips ? 'Show fewer' : `+${data.series.length - CHIP_PREVIEW} more`}</Text>
          </TouchableOpacity>
        )}
      </View>
      {notice && <Text style={styles.notice}>{notice}</Text>}

      <TouchableOpacity style={styles.detailsLink} onPress={onOpenDetails}>
        <Text style={styles.detailsText}>Sales by item details</Text>
      </TouchableOpacity>
    </View>
  );
}

function LegendChip({ series, color, onPress }: { series: SalesSeries; color: string | null; onPress: () => void }) {
  const on = color != null;
  return (
    <TouchableOpacity
      style={[styles.chip, on && styles.chipOn]}
      onPress={onPress}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel={`${series.name}, ${series.total} sold`}
    >
      <View style={[styles.swatch, on ? { backgroundColor: color! } : styles.swatchOff]} />
      <Text style={[styles.chipText, !on && styles.chipTextOff]} numberOfLines={1}>{series.name}</Text>
      <Text style={styles.chipTotal}>{series.total}</Text>
    </TouchableOpacity>
  );
}

/** A 0..yMax scale in 4 equal, round steps (1, 2, 5 × 10^k), at least 0..4. */
function niceScale(peak: number): { yMax: number; step: number } {
  const raw = Math.max(peak, 4) / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw;
  return { yMax: step * 4, step };
}

const styles = StyleSheet.create({
  card: { backgroundColor: COLORS.white, borderRadius: 12, padding: 14, marginBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: SIZES.bodySize, fontWeight: '700', color: COLORS.text },
  subtitle: { fontSize: SIZES.smallSize, color: COLORS.textSecondary, marginTop: 4, marginBottom: 6 },
  rangeRow: { flexDirection: 'row', gap: 6 },
  rangeChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border },
  rangeChipOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  rangeText: { fontSize: SIZES.smallSize, color: COLORS.text },
  rangeTextOn: { color: COLORS.white, fontWeight: '600' },
  errorText: { color: '#D93025', marginVertical: 24, textAlign: 'center' },
  emptyText: { color: COLORS.textSecondary, marginVertical: 24, textAlign: 'center' },
  axisText: { position: 'absolute', fontSize: 10, color: '#6B6B6B' },
  axisTextOn: { color: COLORS.text, fontWeight: '700' },
  yLabel: { left: 0, width: PAD.left - 6, textAlign: 'right' },
  xLabels: { position: 'absolute', bottom: 2, flexDirection: 'row', justifyContent: 'space-between' },
  xLabel: { position: 'relative', width: 40, textAlign: 'center' },
  noSalesOverlay: {
    position: 'absolute', left: PAD.left, right: PAD.right, top: PAD.top, height: PLOT_HEIGHT,
    justifyContent: 'center', alignItems: 'center',
  },
  noSalesText: { fontSize: SIZES.smallSize, color: COLORS.textSecondary, backgroundColor: COLORS.white, paddingHorizontal: 6 },
  readout: { backgroundColor: COLORS.backgroundSecondary, borderRadius: 8, padding: 10, marginTop: 6 },
  readoutHint: { fontSize: SIZES.smallSize, color: COLORS.textSecondary, textAlign: 'center' },
  readoutTitle: { fontSize: SIZES.smallSize, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  readoutRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2 },
  readoutName: { flex: 1, fontSize: SIZES.smallSize, color: COLORS.text },
  readoutValue: { fontSize: SIZES.smallSize, fontWeight: '700', color: COLORS.text },
  legendHint: { fontSize: 11, color: COLORS.textSecondary, marginTop: 12, marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '100%',
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border,
  },
  chipOn: { borderColor: '#BDBDBD', backgroundColor: COLORS.backgroundSecondary },
  chipText: { fontSize: SIZES.smallSize, color: COLORS.text, fontWeight: '600', flexShrink: 1 },
  chipTextOff: { color: COLORS.textSecondary, fontWeight: '400' },
  chipTotal: { fontSize: SIZES.smallSize, color: COLORS.textSecondary },
  swatch: { width: 10, height: 10, borderRadius: 5 },
  swatchOff: { borderWidth: 1.5, borderColor: '#BDBDBD' },
  moreChip: { paddingHorizontal: 10, paddingVertical: 6, justifyContent: 'center' },
  moreText: { fontSize: SIZES.smallSize, color: COLORS.primary, fontWeight: '600' },
  notice: { fontSize: SIZES.smallSize, color: '#B06000', marginTop: 8 },
  detailsLink: { alignSelf: 'flex-end', marginTop: 12 },
  detailsText: { fontSize: SIZES.smallSize, color: COLORS.primary, fontWeight: '600' },
});
