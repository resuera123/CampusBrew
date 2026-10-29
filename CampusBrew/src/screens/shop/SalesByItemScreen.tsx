import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SIZES } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { ItemSalesService, ItemSales } from '../../services/ItemSalesService';

/**
 * v2.0 FR-5.5 — units sold per menu item (today / this week), best seller first.
 * Tap an item for its trend.
 */
export default function SalesByItemScreen({ navigation }: any) {
  const { token } = useAuth();
  const { socket } = useSocket();
  const [range, setRange] = useState<'today' | 'week'>('today');
  const [items, setItems] = useState<ItemSales[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setItems(await ItemSalesService.list(range, token));
      setError(null);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load sales by item');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, range]);

  // Re-runs on focus and whenever the range (and so `load`) changes.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Units sold change as orders are delivered — refresh live.
  useEffect(() => {
    if (!socket) return;
    const refresh = () => load();
    socket.on('order:delivered', refresh);
    return () => socket.off('order:delivered', refresh);
  }, [socket, load]);

  const total = items.reduce((sum, i) => sum + i.unitsSold, 0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.topBarIcon} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Sales by Item</Text>
        <View style={styles.topBarIcon} />
      </View>

      <View style={styles.rangeRow}>
        {(['today', 'week'] as const).map((r) => (
          <TouchableOpacity
            key={r}
            style={[styles.rangeChip, range === r && styles.rangeChipOn]}
            onPress={() => setRange(r)}
          >
            <Text style={[styles.rangeText, range === r && styles.rangeTextOn]}>
              {r === 'today' ? 'Today' : 'This Week'}
            </Text>
          </TouchableOpacity>
        ))}
        <Text style={styles.totalText}>{total} sold</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={COLORS.primary}
            />
          }
        >
          {error && <Text style={styles.errorText}>{error}</Text>}

          <View style={styles.headerRow}>
            <Text style={[styles.headerText, styles.colRank]}>#</Text>
            <Text style={[styles.headerText, { flex: 1 }]}>Item</Text>
            <Text style={[styles.headerText, styles.colSold]}>Sold</Text>
          </View>

          {items.length === 0 ? (
            <Text style={styles.emptyText}>No menu items yet. Add items in Menu Items.</Text>
          ) : (
            items.map((item, i) => (
              <TouchableOpacity
                key={item.itemId}
                style={styles.row}
                onPress={() => navigation.navigate('ItemTrend', { itemId: item.itemId, name: item.name })}
              >
                <Text style={[styles.cellMuted, styles.colRank]}>{item.unitsSold > 0 ? i + 1 : '–'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                  {!item.isAvailable && <Text style={styles.unavailable}>Unavailable</Text>}
                </View>
                <Text style={[styles.cellText, styles.colSold]}>{item.unitsSold}</Text>
                <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} />
              </TouchableOpacity>
            ))
          )}

          <Text style={styles.legend}>Tap an item for its trend.</Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.backgroundSecondary },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
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
  rangeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: SIZES.screenPadding, paddingBottom: 4 },
  rangeChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.white },
  rangeChipOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  rangeText: { fontSize: SIZES.captionSize, color: COLORS.text },
  rangeTextOn: { color: COLORS.white, fontWeight: '600' },
  totalText: { marginLeft: 'auto', fontSize: SIZES.captionSize, color: COLORS.textSecondary },
  content: { padding: SIZES.screenPadding, paddingBottom: 32 },
  errorText: { color: '#D93025', marginBottom: 8 },
  headerRow: { flexDirection: 'row', paddingHorizontal: 14, paddingBottom: 6 },
  headerText: { fontSize: SIZES.smallSize, fontWeight: '700', color: COLORS.textSecondary },
  colRank: { width: 26 },
  colSold: { width: 56, textAlign: 'center' },
  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white, borderRadius: 12, padding: 14, marginBottom: 8,
  },
  itemName: { fontSize: SIZES.captionSize, color: COLORS.text, fontWeight: '600' },
  unavailable: { fontSize: SIZES.smallSize, color: COLORS.textSecondary, marginTop: 2 },
  cellText: { fontSize: SIZES.captionSize, color: COLORS.text, fontWeight: '700' },
  cellMuted: { fontSize: SIZES.captionSize, color: COLORS.textSecondary },
  emptyText: { textAlign: 'center', color: COLORS.textSecondary, marginTop: 24 },
  legend: { fontSize: SIZES.smallSize, color: COLORS.textSecondary, marginTop: 8, textAlign: 'center' },
});
