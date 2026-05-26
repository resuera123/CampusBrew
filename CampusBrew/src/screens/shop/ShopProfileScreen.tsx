import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SIZES } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { ShopService, Shop } from '../../services/ShopService';
import ConfirmDialog from '../../components/ConfirmDialog';

export default function ShopProfileScreen({ navigation }: any) {
  const { token, user, logout } = useAuth();
  const [shop, setShop] = useState<Shop | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logoutOpen, setLogoutOpen] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setError(null);
      const myShop = await ShopService.getMyShop(token);
      setShop(myShop);
    } catch (e: any) {
      setError(e.message || 'Could not load shop profile');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
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

        <View style={styles.imageWrap}>
          {shop?.shopImage ? (
            <Image source={{ uri: shop.shopImage }} style={styles.shopImage} />
          ) : (
            <View style={[styles.shopImage, styles.placeholderImage]}>
              <Ionicons name="storefront-outline" size={48} color={COLORS.textSecondary} />
            </View>
          )}
        </View>

        <Text style={styles.shopName}>{shop?.shopName ?? '—'}</Text>
        <Text style={styles.operator}>Operated by {user?.fullName}</Text>

        <View style={styles.section}>
          <Row icon="document-text-outline" label="Description" value={shop?.description || 'No description yet'} />
          <Row icon="location-outline" label="Location" value={shop?.location || 'Not set'} />
          <Row icon="time-outline" label="Est. prep time" value={shop?.estimatedPrepTime || 'Not set'} />
          <Row
            icon="radio-button-on"
            label="Status"
            value={shop?.isOpen ? 'Open' : 'Closed'}
            valueColor={shop?.isOpen ? '#1E8E3E' : '#D93025'}
          />
        </View>

        <TouchableOpacity
          style={styles.editBtn}
          onPress={() => navigation.navigate('EditShopProfile', { shopId: shop?.id })}
        >
          <Text style={styles.editBtnText}>Edit Profile</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutBtn} onPress={() => setLogoutOpen(true)}>
          <Ionicons name="log-out-outline" size={18} color="#D93025" />
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>
      </ScrollView>

      <ConfirmDialog
        visible={logoutOpen}
        title="Log out?"
        message="You'll need to sign back in to manage your shop."
        confirmLabel="Log out"
        destructive
        icon="log-out-outline"
        onCancel={() => setLogoutOpen(false)}
        onConfirm={() => {
          setLogoutOpen(false);
          logout();
        }}
      />
    </SafeAreaView>
  );
}

function Row({
  icon,
  label,
  value,
  valueColor,
}: {
  icon: any;
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={18} color={COLORS.primary} style={{ marginRight: 12 }} />
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={[styles.rowValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.backgroundSecondary },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.backgroundSecondary },
  content: { padding: SIZES.screenPadding, paddingBottom: 32, alignItems: 'center' },
  errorText: { color: '#D93025', marginBottom: 12, alignSelf: 'stretch' },
  imageWrap: { marginTop: 8, marginBottom: 12 },
  shopImage: { width: 100, height: 100, borderRadius: 50, backgroundColor: COLORS.white },
  placeholderImage: { justifyContent: 'center', alignItems: 'center' },
  shopName: { fontSize: SIZES.titleSize, fontWeight: '700', color: COLORS.text, marginTop: 4 },
  operator: { fontSize: SIZES.captionSize, color: COLORS.textSecondary, marginTop: 2 },
  section: {
    width: '100%',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingVertical: 4,
    marginTop: 24,
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  rowLabel: { fontSize: SIZES.smallSize, color: COLORS.textSecondary },
  rowValue: { fontSize: SIZES.captionSize, color: COLORS.text, marginTop: 2 },
  editBtn: {
    alignSelf: 'stretch',
    height: SIZES.buttonHeight,
    backgroundColor: COLORS.primary,
    borderRadius: SIZES.buttonBorderRadius,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editBtnText: { color: COLORS.white, fontSize: SIZES.buttonFontSize, fontWeight: '600' },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    padding: 10,
  },
  logoutText: { color: '#D93025', fontWeight: '500' },
});
