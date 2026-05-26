import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SIZES } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { ShopService, MenuItem } from '../../services/ShopService';
import ItemEditorModal from './ItemEditorModal';

export default function MenuManagementScreen({ route, navigation }: any) {
  const { token } = useAuth();
  const [shopId, setShopId] = useState<string | undefined>(route?.params?.shopId);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setError(null);
      let resolvedShopId = shopId;
      if (!resolvedShopId) {
        const myShop = await ShopService.getMyShop(token);
        resolvedShopId = myShop.id;
        setShopId(resolvedShopId);
      }
      const menu = await ShopService.getMenu(resolvedShopId);
      setItems(menu);
    } catch (e: any) {
      setError(e.message || 'Could not load menu');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, shopId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleDelete = (item: MenuItem) => {
    Alert.alert(
      'Delete item?',
      `"${item.name}" will be removed from your menu.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!token) return;
            try {
              await ShopService.deleteMenuItem(item.id, token);
              await load();
            } catch (e: any) {
              Alert.alert('Failed to delete', e.message || 'Could not remove item');
            }
          },
        },
      ],
    );
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
        <Text style={styles.topBarTitle}>Menu Management</Text>
        <View style={styles.topBarIcon} />
      </View>

      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={COLORS.primary}
          />
        }
      >
        {error && <Text style={styles.errorText}>{error}</Text>}

        {items.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="restaurant-outline" size={48} color={COLORS.textSecondary} />
            <Text style={styles.emptyTitle}>No items yet</Text>
            <Text style={styles.emptySub}>Tap “Add Item” to add your first beverage.</Text>
          </View>
        ) : (
          items.map((item) => (
            <View key={item.id} style={styles.itemCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemMeta}>
                  ₱{item.price.toFixed(2)} • {item.category}
                </Text>
                {!item.isAvailable && (
                  <Text style={styles.unavailableTag}>Currently unavailable</Text>
                )}
              </View>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => {
                  setEditing(item);
                  setEditorOpen(true);
                }}
              >
                <Ionicons name="create-outline" size={20} color={COLORS.primary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn} onPress={() => handleDelete(item)}>
                <Ionicons name="trash-outline" size={20} color="#D93025" />
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>

      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          setEditing(null);
          setEditorOpen(true);
        }}
      >
        <Ionicons name="add" size={20} color={COLORS.white} />
        <Text style={styles.fabText}>Add Item</Text>
      </TouchableOpacity>

      <ItemEditorModal
        visible={editorOpen}
        shopId={shopId ?? ''}
        item={editing}
        onClose={() => setEditorOpen(false)}
        onSaved={async () => {
          setEditorOpen(false);
          await load();
        }}
      />
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
  list: { padding: SIZES.screenPadding, paddingBottom: 100 },
  errorText: { color: '#D93025', marginBottom: 12 },
  emptyState: { alignItems: 'center', paddingVertical: 64 },
  emptyTitle: { fontSize: SIZES.bodySize, fontWeight: '600', color: COLORS.text, marginTop: 12 },
  emptySub: { fontSize: SIZES.smallSize, color: COLORS.textSecondary, marginTop: 4, textAlign: 'center' },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  itemName: { fontSize: SIZES.bodySize, fontWeight: '600', color: COLORS.text },
  itemMeta: { fontSize: SIZES.smallSize, color: COLORS.textSecondary, marginTop: 2 },
  unavailableTag: { fontSize: SIZES.smallSize, color: '#D93025', marginTop: 4 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 6,
  },
  fabText: { color: COLORS.white, fontWeight: '600' },
});
