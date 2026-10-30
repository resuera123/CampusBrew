import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { SalesReportService, SalesReport, ReportRange } from '../../services/SalesReportService';

/**
 * v2.0 FR-4.6 — daily / weekly sales report: totals vs the period before, sales
 * by hour or day, GCash vs COD, top items, cancellations and the delivered orders.
 * Money is the drinks subtotal (delivery fees and tips go to the dasher).
 */
export default function SalesReportScreen({ navigation }: any) {
  const { token } = useAuth();
  const [range, setRange] = useState<ReportRange>('day');
  const [offset, setOffset] = useState(0);
  const [report, setReport] = useState<SalesReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setReport(await SalesReportService.report(range, offset, token));
      setError(null);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load the sales report');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, range, offset]);

  useEffect(() => { load(); }, [load]);

  const changeRange = (r: ReportRange) => {
    if (r === range) return;
    setLoading(true);
    setRange(r);
    setOffset(0);
  };

  const step = (by: number) => {
    setLoading(true);
    setOffset((o) => Math.max(0, o + by));
  };

  const prevName = range === 'day' ? 'the day before' : 'the week before';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.topBarIcon} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Sales Report</Text>
        <View style={styles.topBarIcon} />
      </View>

      <View style={styles.controls}>
        <View style={styles.toggle}>
          {(['day', 'week'] as ReportRange[]).map((r) => (
            <TouchableOpacity
              key={r}
              style={[styles.toggleBtn, range === r && styles.toggleBtnOn]}
              onPress={() => changeRange(r)}
            >
              <Text style={[styles.toggleText, range === r && styles.toggleTextOn]}>
                {r === 'day' ? 'Daily' : 'Weekly'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.stepper}>
          <TouchableOpacity onPress={() => step(1)} hitSlop={8} style={styles.stepBtn}>
            <Ionicons name="chevron-back" size={20} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.period}>{report?.label ?? (range === 'day' ? 'Today' : 'This week')}</Text>
          <TouchableOpacity onPress={() => step(-1)} hitSlop={8} style={styles.stepBtn} disabled={offset === 0}>
            <Ionicons name="chevron-forward" size={20} color={offset === 0 ? COLORS.border : COLORS.text} />
          </TouchableOpacity>
        </View>
      </View>

      {loading && !report ? (
        <View style={styles.center}><ActivityIndicator color={COLORS.primary} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.primary} />
          }
        >
          {error && <Text style={styles.error}>{error}</Text>}
          {report && (
            <View style={loading ? { opacity: 0.5 } : undefined}>
              <View style={styles.tiles}>
                <Tile label="Sales" value={peso(report.sales)} now={report.sales} before={report.prevSales} />
                <Tile label="Orders" value={String(report.orders)} now={report.orders} before={report.prevOrders} />
                <Tile
                  label="Avg. order"
                  value={peso(report.avgOrder)}
                  now={report.avgOrder}
                  before={report.prevAvgOrder}
                />
                <View style={styles.tile}>
                  <Text style={styles.tileLabel}>Cancelled</Text>
                  <Text style={styles.tileValue}>{report.cancelledOrders}</Text>
                  <Text style={styles.tileNote}>
                    {report.cancelledOrders === 0
                      ? 'None'
                      : `${peso(report.cancelledSales)} lost${report.refundedOrders ? ` · ${report.refundedOrders} refunded` : ''}`}
                  </Text>
                </View>
              </View>
              <Text style={styles.compareNote}>Arrows compare with {prevName}.</Text>

              <Card title={range === 'day' ? 'Sales by hour' : 'Sales by day'}>
                <BarChart buckets={report.buckets} />
                <Text style={styles.peak}>
                  {report.peakLabel ? `Busiest: ${report.peakLabel}` : 'No sales in this period yet.'}
                </Text>
              </Card>

              <Card title="Payment">
                <PaymentRow
                  icon="phone-portrait-outline"
                  label="GCash"
                  amount={report.gcashSales}
                  orders={report.gcashOrders}
                  total={report.sales}
                />
                <PaymentRow
                  icon="cash-outline"
                  label="Cash on Delivery"
                  amount={report.codSales}
                  orders={report.codOrders}
                  total={report.sales}
                />
              </Card>

              <Card
                title="Top items"
                action={{ label: 'Sales by Item', onPress: () => navigation.navigate('SalesByItem') }}
              >
                {report.topItems.length === 0 ? (
                  <Text style={styles.muted}>Nothing sold yet.</Text>
                ) : (
                  report.topItems.map((t, i) => (
                    <View key={t.itemId} style={styles.topRow}>
                      <Text style={styles.rank}>{i + 1}</Text>
                      <Text style={styles.topName} numberOfLines={1}>{t.itemName}</Text>
                      <Text style={styles.topQty}>{t.qty} sold</Text>
                    </View>
                  ))
                )}
              </Card>

              <Card title={`Delivered orders (${report.orderList.length})`}>
                {report.orderList.length === 0 ? (
                  <Text style={styles.muted}>No delivered orders in this period.</Text>
                ) : (
                  report.orderList.map((o) => (
                    <View key={o.orderId} style={styles.orderRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.orderId}>
                          #{o.orderId.slice(-6).toUpperCase()}
                          <Text style={styles.orderMeta}>
                            {'  '}{formatTime(o.deliveredAt, range)} · {o.paymentMethod === 'COD' ? 'COD' : 'GCash'}
                          </Text>
                        </Text>
                        <Text style={styles.orderItems} numberOfLines={2}>{o.items}</Text>
                      </View>
                      <Text style={styles.orderAmount}>{peso(o.amount)}</Text>
                    </View>
                  ))
                )}
              </Card>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Tile({ label, value, now, before }: { label: string; value: string; now: number; before: number }) {
  const change = before > 0 ? Math.round(((now - before) / before) * 100) : null;
  const up = change != null && change > 0;
  const down = change != null && change < 0;
  return (
    <View style={styles.tile}>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={styles.tileValue}>{value}</Text>
      <View style={styles.changeRow}>
        {change == null ? (
          <Text style={styles.tileNote}>{now > 0 ? 'New' : '—'}</Text>
        ) : (
          <>
            {(up || down) && (
              <Ionicons name={up ? 'caret-up' : 'caret-down'} size={12} color={up ? '#1E8E3E' : '#D93025'} />
            )}
            <Text style={styles.tileNote}>{change === 0 ? 'Same' : `${Math.abs(change)}%`}</Text>
          </>
        )}
      </View>
    </View>
  );
}

/** Single-series bars: one color, rounded tops, faint grid, tap a bar to read it. */
function BarChart({ buckets }: { buckets: SalesReport['buckets'] }) {
  const [selected, setSelected] = useState<number | null>(null);
  const max = Math.max(0, ...buckets.map((b) => b.sales));
  const top = niceMax(max);
  const many = buckets.length > 8;
  const shown = selected != null ? buckets[selected] : null;

  useEffect(() => { setSelected(null); }, [buckets]);

  return (
    <View>
      <Text style={styles.readout}>
        {shown ? `${shown.label}: ${peso(shown.sales)} · ${shown.orders} order${shown.orders === 1 ? '' : 's'}` : 'Tap a bar for details'}
      </Text>
      <View style={styles.chart}>
        <View style={styles.yAxis}>
          <Text style={styles.axisText}>{top > 0 ? short(top) : ''}</Text>
          <Text style={styles.axisText}>{top > 0 ? short(top / 2) : ''}</Text>
          <Text style={styles.axisText}>₱0</Text>
        </View>
        <View style={styles.plot}>
          <View style={[styles.gridLine, { top: 0 }]} />
          <View style={[styles.gridLine, { top: '50%' }]} />
          <View style={[styles.gridLine, styles.baseline]} />
          <View style={styles.bars}>
            {buckets.map((b, i) => {
              const h = top > 0 ? (b.sales / top) * 100 : 0;
              const dim = selected != null && selected !== i;
              return (
                <Pressable
                  key={b.label + i}
                  style={styles.barSlot}
                  onPress={() => setSelected(selected === i ? null : i)}
                  hitSlop={{ top: 8, bottom: 8 }}
                >
                  {b.sales > 0 && (
                    <View
                      style={[
                        styles.bar,
                        { height: `${Math.max(h, 2)}%`, maxWidth: many ? 12 : 28 },
                        dim && { opacity: 0.35 },
                      ]}
                    />
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
      <View style={styles.xAxis}>
        {buckets.map((b, i) => (
          <Text key={b.label + i} style={[styles.axisText, styles.xLabel]}>
            {!many || i % 3 === 0 ? b.label : ''}
          </Text>
        ))}
      </View>
    </View>
  );
}

function PaymentRow({
  icon,
  label,
  amount,
  orders,
  total,
}: {
  icon: any;
  label: string;
  amount: number;
  orders: number;
  total: number;
}) {
  const share = total > 0 ? Math.round((amount / total) * 100) : 0;
  return (
    <View style={styles.payRow}>
      <Ionicons name={icon} size={18} color={COLORS.primary} />
      <View style={{ flex: 1 }}>
        <View style={styles.payHead}>
          <Text style={styles.payLabel}>{label}</Text>
          <Text style={styles.payAmount}>{peso(amount)}</Text>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${share}%` }]} />
        </View>
        <Text style={styles.tileNote}>
          {orders} order{orders === 1 ? '' : 's'} · {share}%
        </Text>
      </View>
    </View>
  );
}

function Card({
  title,
  action,
  children,
}: {
  title: string;
  action?: { label: string; onPress: () => void };
  children: React.ReactNode;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Text style={styles.cardTitle}>{title}</Text>
        {action && (
          <TouchableOpacity onPress={action.onPress}>
            <Text style={styles.cardAction}>{action.label} ›</Text>
          </TouchableOpacity>
        )}
      </View>
      {children}
    </View>
  );
}

function peso(v: number) {
  return `₱${v.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function short(v: number) {
  return v >= 1000 ? `₱${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k` : `₱${Math.round(v)}`;
}

/** Round the axis top up to 1 / 2 / 5 × 10ⁿ so the gridlines land on even values. */
function niceMax(v: number) {
  if (v <= 0) return 0;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return nice * pow;
}

function formatTime(iso: string, range: ReportRange) {
  const d = new Date(iso);
  return range === 'day'
    ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' });
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
  controls: {
    backgroundColor: COLORS.background,
    paddingHorizontal: SIZES.screenPadding,
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  toggle: { flexDirection: 'row', backgroundColor: COLORS.backgroundSecondary, borderRadius: 18, padding: 3 },
  toggleBtn: { flex: 1, paddingVertical: 7, borderRadius: 15, alignItems: 'center' },
  toggleBtnOn: { backgroundColor: COLORS.primary },
  toggleText: { fontSize: SIZES.captionSize, fontWeight: '600', color: COLORS.text },
  toggleTextOn: { color: COLORS.white },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepBtn: { padding: 4 },
  period: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: SIZES.screenPadding, paddingBottom: 32 },
  error: { color: '#D93025', marginBottom: 12 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: '48%', flexGrow: 1, backgroundColor: COLORS.white, borderRadius: 12, padding: 12 },
  tileLabel: { fontSize: SIZES.smallSize, color: COLORS.textSecondary },
  tileValue: { fontSize: 20, fontWeight: '700', color: COLORS.text, marginTop: 4 },
  tileNote: { fontSize: SIZES.smallSize, color: COLORS.textSecondary, marginTop: 2 },
  changeRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2 },
  compareNote: { fontSize: 11, color: COLORS.textSecondary, marginTop: 6, marginBottom: 12 },
  card: { backgroundColor: COLORS.white, borderRadius: 12, padding: 14, marginBottom: 12 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  cardAction: { fontSize: SIZES.smallSize, color: COLORS.primary, fontWeight: '600' },
  readout: { fontSize: SIZES.smallSize, color: COLORS.textSecondary, marginBottom: 8 },
  chart: { flexDirection: 'row', height: 140 },
  yAxis: { width: 40, justifyContent: 'space-between', paddingRight: 4 },
  plot: { flex: 1, position: 'relative' },
  gridLine: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: COLORS.border },
  baseline: { bottom: 0, backgroundColor: '#C8C8C8' },
  bars: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  barSlot: { flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  bar: { width: '100%', backgroundColor: COLORS.primary, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  xAxis: { flexDirection: 'row', marginLeft: 40, marginTop: 4, gap: 2 },
  xLabel: { flex: 1, textAlign: 'center' },
  axisText: { fontSize: 10, color: COLORS.textSecondary },
  peak: { fontSize: SIZES.captionSize, color: COLORS.text, fontWeight: '600', marginTop: 10 },
  payRow: { flexDirection: 'row', gap: 10, paddingVertical: 6 },
  payHead: { flexDirection: 'row', justifyContent: 'space-between' },
  payLabel: { fontSize: SIZES.captionSize, color: COLORS.text, fontWeight: '600' },
  payAmount: { fontSize: SIZES.captionSize, color: COLORS.text, fontWeight: '700' },
  track: { height: 6, borderRadius: 3, backgroundColor: COLORS.backgroundSecondary, marginTop: 6, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: COLORS.primary, borderRadius: 3 },
  muted: { fontSize: SIZES.captionSize, color: COLORS.textSecondary },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  rank: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.backgroundSecondary,
    textAlign: 'center',
    lineHeight: 22,
    fontSize: SIZES.smallSize,
    fontWeight: '700',
    color: COLORS.text,
  },
  topName: { flex: 1, fontSize: SIZES.captionSize, color: COLORS.text },
  topQty: { fontSize: SIZES.captionSize, color: COLORS.textSecondary },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  orderId: { fontSize: SIZES.captionSize, fontWeight: '700', color: COLORS.text },
  orderMeta: { fontWeight: '400', color: COLORS.textSecondary, fontSize: SIZES.smallSize },
  orderItems: { fontSize: SIZES.smallSize, color: COLORS.textSecondary, marginTop: 2 },
  orderAmount: { fontSize: SIZES.captionSize, fontWeight: '700', color: COLORS.text },
});
