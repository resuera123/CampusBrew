import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import { COLORS, SIZES } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { DeliveryService, DeliveryPersonnelProfile } from '../../services/DeliveryService';

export default function DeliveryDashboardScreen({ navigation }: any) {
  const { token, user } = useAuth();
  const { socket } = useSocket();
  const [profile, setProfile] = useState<DeliveryPersonnelProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [togglingActive, setTogglingActive] = useState(false);
  const [refreshingLocation, setRefreshingLocation] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setError(null);
      const p = await DeliveryService.getMyProfile(token);
      setProfile(p);
    } catch (e: any) {
      setError(e.message || 'Could not load delivery profile');
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

  // Realtime: totalDeliveries + incentiveActive change after every delivery the
  // DP completes. The order:statusUpdate stream fires for those transitions, so
  // we listen and refresh the profile.
  useEffect(() => {
    if (!socket) return;
    const onAny = () => load();
    socket.on('order:statusUpdate', onAny);
    socket.on('order:assigned', onAny);
    return () => {
      socket.off('order:statusUpdate', onAny);
      socket.off('order:assigned', onAny);
    };
  }, [socket, load]);

  const pushLocation = async (): Promise<boolean> => {
    if (!token) return false;
    setError(null);
    setRefreshingLocation(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        setError('Location permission denied. Grant access in Settings to share your location.');
        return false;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const updated = await DeliveryService.updateLocation(
        pos.coords.longitude,
        pos.coords.latitude,
        token,
      );
      setProfile(updated);
      return true;
    } catch (e: any) {
      setError(e.message || 'Could not get your current location.');
      return false;
    } finally {
      setRefreshingLocation(false);
    }
  };

  const toggleActive = async (next: boolean) => {
    if (!token || !profile) return;
    setTogglingActive(true);
    try {
      if (next) {
        const ok = await pushLocation();
        if (!ok) {
          setTogglingActive(false);
          return;
        }
      }
      const updated = await DeliveryService.setAvailability(next, token);
      setProfile(updated);
    } catch (e: any) {
      Alert.alert('Could not update status', e.message || 'Please try again.');
    } finally {
      setTogglingActive(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const hasLocation = profile?.longitude != null && profile?.latitude != null;
  const locationCoords = hasLocation
    ? `${profile!.latitude!.toFixed(4)}, ${profile!.longitude!.toFixed(4)}`
    : 'Not set';
  const locationSubtitle = hasLocation
    ? `${locationCoords}${profile?.locationUpdatedAt ? ` · updated ${formatRelative(profile.locationUpdatedAt)}` : ''}`
    : 'Not set — tap to share';

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
        <View style={styles.header}>
          <Text style={styles.greeting}>Hello,</Text>
          <Text style={styles.name}>{user?.fullName ?? 'Rider'}</Text>
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}

        <View style={[styles.statusCard, profile?.isActive ? styles.statusCardActive : null]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.statusLabel}>You are</Text>
            <Text style={[styles.statusValue, profile?.isActive ? styles.statusValueActive : null]}>
              {profile?.isActive ? 'Active' : 'Inactive'}
            </Text>
            <Text style={styles.statusSub}>
              {profile?.isActive
                ? 'Available for order assignment'
                : 'Toggle on to start receiving orders'}
            </Text>
          </View>
          {togglingActive ? (
            <ActivityIndicator color={COLORS.primary} />
          ) : (
            <Switch
              value={!!profile?.isActive}
              onValueChange={toggleActive}
              trackColor={{ true: COLORS.primary, false: COLORS.border }}
              thumbColor={COLORS.white}
            />
          )}
        </View>

        <View style={styles.statRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{profile?.totalDeliveries ?? 0}</Text>
            <Text style={styles.statLabel}>Deliveries completed</Text>
          </View>
          <View style={styles.statCard}>
            <View style={styles.incentiveValueRow}>
              {profile?.incentiveActive ? (
                <>
                  <Ionicons name="checkmark-circle" size={18} color="#1E8E3E" />
                  <Text style={[styles.statValue, { color: '#1E8E3E' }]}>Unlocked</Text>
                </>
              ) : (
                <>
                  <Ionicons name="lock-closed" size={16} color={COLORS.textSecondary} />
                  <Text style={styles.statValue}>{profile?.totalDeliveries ?? 0}/10</Text>
                </>
              )}
            </View>
            <Text style={styles.statLabel}>Incentive status</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Settings</Text>

        <ActionRow
          icon="calendar-outline"
          label="Schedule Settings"
          subtitle="Set your weekly availability"
          onPress={() => navigation.navigate('ScheduleSettings')}
        />
        <ActionRow
          icon="archive-outline"
          label="Delivery History"
          subtitle="Your completed deliveries"
          onPress={() => navigation.navigate('DeliveryHistory')}
        />
        <TouchableOpacity style={styles.actionRow} onPress={pushLocation} disabled={refreshingLocation}>
          <View style={styles.actionIconWrap}>
            <Ionicons name="location-outline" size={22} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.actionLabel}>Current Location</Text>
            <Text style={styles.actionSubtitle}>
              {refreshingLocation ? 'Refreshing…' : locationSubtitle}
            </Text>
          </View>
          {refreshingLocation
            ? <ActivityIndicator size="small" color={COLORS.primary} />
            : <Ionicons name="refresh-outline" size={20} color={COLORS.textSecondary} />}
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

function formatRelative(iso: string): string {
  try {
    const then = new Date(iso).getTime();
    const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000));
    if (diffSec < 60) return 'just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return new Date(iso).toLocaleDateString();
  } catch {
    return '';
  }
}

function ActionRow({
  icon,
  label,
  subtitle,
  onPress,
}: {
  icon: any;
  label: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.actionRow} onPress={onPress}>
      <View style={styles.actionIconWrap}>
        <Ionicons name={icon} size={22} color={COLORS.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.actionLabel}>{label}</Text>
        <Text style={styles.actionSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.backgroundSecondary },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.backgroundSecondary },
  content: { padding: SIZES.screenPadding, paddingBottom: 32 },
  header: { marginBottom: 20 },
  greeting: { fontSize: SIZES.captionSize, color: COLORS.textSecondary },
  name: { fontSize: SIZES.titleSize, fontWeight: '700', color: COLORS.text, marginTop: 2 },
  errorText: { color: '#D93025', marginBottom: 12 },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.border,
  },
  statusCardActive: { borderLeftColor: COLORS.primary },
  statusLabel: { fontSize: SIZES.smallSize, color: COLORS.textSecondary },
  statusValue: { fontSize: 22, fontWeight: '700', color: COLORS.textSecondary, marginTop: 2 },
  statusValueActive: { color: COLORS.primary },
  statusSub: { fontSize: SIZES.smallSize, color: COLORS.textSecondary, marginTop: 4 },
  statRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 14,
  },
  statValue: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  incentiveValueRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statLabel: { fontSize: SIZES.smallSize, color: COLORS.textSecondary, marginTop: 2 },
  sectionTitle: { fontSize: SIZES.bodySize, fontWeight: '600', color: COLORS.text, marginBottom: 10 },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  actionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  actionLabel: { fontSize: SIZES.bodySize, fontWeight: '600', color: COLORS.text },
  actionSubtitle: { fontSize: SIZES.smallSize, color: COLORS.textSecondary, marginTop: 2 },
});
