import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SIZES } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { InventoryService, InventoryItem } from '../../services/InventoryService';

/**
 * v2.0 FR-5.5 — units sold per item (today / this week) and stock. Stock tracking is
 * optional per item; tracked items are deducted on every delivered order, go
 * unavailable at 0 (FR-5.2) and flag low stock. Tap an item for its trend.
 */
export default function InventoryMovementScreen({ navigation }: any) {
  const { token } = useAuth();
  const { socket } = useSocket();
  const [range, setRange] = useState<'today' | 'week'>('today');
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<InventoryItem | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setItems(await InventoryService.list(range, token));
      setError(null);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load inventory');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, range]);

  // Re-runs on focus and whenever the range (and so `load`) changes.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Stock changes as orders are delivered — refresh live.
  useEffect(() => {
    if (!socket) return;
    const refresh = () => load();
    socket.on('order:delivered', refresh);
    socket.on('inventory:lowStock', refresh);
    return () => {
      socket.off('order:delivered', refresh);
      socket.off('inventory:lowStock', refresh);
    };
  }, [socket, load]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.topBarIcon} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Inventory</Text>
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
            <Text style={[styles.headerText, { flex: 1 }]}>Item</Text>
            <Text style={[styles.headerText, styles.colSold]}>Sold</Text>
            <Text style={[styles.headerText, styles.colStock]}>Stock</Text>
          </View>

          {items.length === 0 ? (
            <Text style={styles.emptyText}>No menu items yet. Add items in Menu Items.</Text>
          ) : (
            items.map((item) => (
              <TouchableOpacity
                key={item.itemId}
                style={styles.row}
                onPress={() => navigation.navigate('ItemTrend', { itemId: item.itemId, name: item.name })}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                  <TouchableOpacity onPress={() => setEditing(item)} hitSlop={6}>
                    <Text style={styles.stockAction}>
                      {item.stockTracking ? 'Restock' : 'Track stock'}
                    </Text>
                  </TouchableOpacity>
                </View>
                <Text style={[styles.cellText, styles.colSold]}>{item.unitsSold}</Text>
                <View style={styles.colStock}>
                  <StockCell item={item} />
                </View>
              </TouchableOpacity>
            ))
          )}

          <Text style={styles.legend}>
            <Ionicons name="warning" size={11} color="#B06000" /> low stock · – not tracked · tap an item for its trend
          </Text>
        </ScrollView>
      )}

      <StockSheet
        item={editing}
        token={token}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); load(); }}
      />
    </SafeAreaView>
  );
}

function StockCell({ item }: { item: InventoryItem }) {
  if (!item.stockTracking) return <Text style={styles.cellMuted}>–</Text>;
  if ((item.stockQty ?? 0) <= 0) return <Text style={styles.cellOut}>0 (off)</Text>;
  return (
    <View style={styles.stockInline}>
      <Text style={[styles.cellText, item.lowStock && styles.cellLow]}>{item.stockQty}</Text>
      {item.lowStock && <Ionicons name="warning" size={13} color="#B06000" />}
    </View>
  );
}

/** Bottom sheet: restock a tracked item, or turn tracking on/off. */
function StockSheet({
  item,
  token,
  onClose,
  onSaved,
}: {
  item: InventoryItem | null;
  token: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [qty, setQty] = useState('');
  const [low, setLow] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setQty('');
    setLow(item?.lowStockLevel != null ? String(item.lowStockLevel) : '');
  }, [item?.itemId]);

  if (!item) return null;
  const tracked = item.stockTracking;

  const run = async (action: () => Promise<unknown>) => {
    setSaving(true);
    try {
      await action();
      onSaved();
    } catch (e: any) {
      Alert.alert('Could not save', e.message ?? 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const save = () => {
    if (!token) return;
    const n = parseInt(qty, 10);
    if (tracked) {
      if (isNaN(n) || n < 1) {
        Alert.alert('Enter a quantity', 'How many units are you adding?');
        return;
      }
      run(() => InventoryService.restock(item.itemId, n, token));
    } else {
      if (isNaN(n) || n < 0) {
        Alert.alert('Enter the current stock', 'How many units do you have right now?');
        return;
      }
      const lowLevel = low.trim() ? parseInt(low, 10) : undefined;
      run(() => InventoryService.setTracking(item.itemId, { enabled: true, quantity: n, lowStockLevel: lowLevel }, token));
    }
  };

  const stopTracking = () => {
    if (!token) return;
    run(() => InventoryService.setTracking(item.itemId, { enabled: false }, token));
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.sheetBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>{tracked ? `Restock ${item.name}` : `Track stock for ${item.name}`}</Text>
          {tracked && (
            <Text style={styles.sheetHint}>
              {item.stockQty} in stock now · low-stock alert at {item.lowStockLevel}
            </Text>
          )}

          <Text style={styles.inputLabel}>{tracked ? 'Units to add' : 'Current stock'}</Text>
          <TextInput
            style={styles.input}
            value={qty}
            onChangeText={setQty}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={COLORS.textSecondary}
            autoFocus
          />

          {!tracked && (
            <>
              <Text style={styles.inputLabel}>Low-stock alert at (optional, default 5)</Text>
              <TextInput
                style={styles.input}
                value={low}
                onChangeText={setLow}
                keyboardType="number-pad"
                placeholder="5"
                placeholderTextColor={COLORS.textSecondary}
              />
              <Text style={styles.sheetHint}>
                Stock goes down with every delivered order. At 0 the item is hidden from customers.
              </Text>
            </>
          )}

          <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={saving}>
            {saving ? <ActivityIndicator color={COLORS.white} />
              : <Text style={styles.saveText}>{tracked ? 'Restock' : 'Start tracking'}</Text>}
          </TouchableOpacity>
          {tracked && (
            <TouchableOpacity style={styles.stopBtn} onPress={stopTracking} disabled={saving}>
              <Text style={styles.stopText}>Stop tracking stock</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
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
  rangeRow: { flexDirection: 'row', gap: 8, padding: SIZES.screenPadding, paddingBottom: 4 },
  rangeChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.white },
  rangeChipOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  rangeText: { fontSize: SIZES.captionSize, color: COLORS.text },
  rangeTextOn: { color: COLORS.white, fontWeight: '600' },
  content: { padding: SIZES.screenPadding, paddingBottom: 32 },
  errorText: { color: '#D93025', marginBottom: 8 },
  headerRow: { flexDirection: 'row', paddingHorizontal: 14, paddingBottom: 6 },
  headerText: { fontSize: SIZES.smallSize, fontWeight: '700', color: COLORS.textSecondary },
  colSold: { width: 56, textAlign: 'center' },
  colStock: { width: 72, alignItems: 'center', textAlign: 'center' },
  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white, borderRadius: 12, padding: 14, marginBottom: 8,
  },
  itemName: { fontSize: SIZES.captionSize, color: COLORS.text, fontWeight: '600' },
  stockAction: { fontSize: SIZES.smallSize, color: COLORS.primary, fontWeight: '600', marginTop: 4 },
  cellText: { fontSize: SIZES.captionSize, color: COLORS.text },
  cellMuted: { fontSize: SIZES.captionSize, color: COLORS.textSecondary },
  cellLow: { color: '#B06000', fontWeight: '700' },
  cellOut: { fontSize: SIZES.smallSize, color: '#D93025', fontWeight: '700' },
  stockInline: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  emptyText: { textAlign: 'center', color: COLORS.textSecondary, marginTop: 24 },
  legend: { fontSize: SIZES.smallSize, color: COLORS.textSecondary, marginTop: 8, textAlign: 'center' },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    backgroundColor: COLORS.white, borderTopLeftRadius: 16, borderTopRightRadius: 16,
    padding: 20, paddingBottom: 32,
  },
  sheetTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  sheetHint: { fontSize: SIZES.smallSize, color: COLORS.textSecondary, marginTop: 6 },
  inputLabel: { fontSize: SIZES.smallSize, fontWeight: '600', color: COLORS.text, marginTop: 14 },
  input: {
    marginTop: 6, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: SIZES.bodySize, color: COLORS.text,
  },
  saveBtn: {
    marginTop: 18, height: SIZES.buttonHeight, borderRadius: SIZES.buttonBorderRadius,
    backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center',
  },
  saveText: { color: COLORS.white, fontSize: 15, fontWeight: '700' },
  stopBtn: { marginTop: 10, alignItems: 'center', paddingVertical: 8 },
  stopText: { color: '#D93025', fontSize: SIZES.captionSize, fontWeight: '600' },
});
