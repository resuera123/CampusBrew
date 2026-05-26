import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES } from '../../constants/theme';
import { useNotifications, Notification } from '../../context/NotificationsContext';

export default function NotificationScreen({ navigation }: any) {
  const { notifications, markAllRead, clear } = useNotifications();

  // Mark all read when the screen opens.
  useEffect(() => {
    markAllRead();
    // intentionally empty — markAllRead is stable enough for this one-shot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openOrder = (orderId?: string) => {
    if (!orderId) return;
    try { navigation.navigate('OrderTracking', { orderId }); } catch { /* not on this stack */ }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.topBarIcon} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Notifications</Text>
        {notifications.length > 0 ? (
          <TouchableOpacity style={styles.topBarIcon} onPress={clear}>
            <Ionicons name="trash-outline" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>
        ) : (
          <View style={styles.topBarIcon} />
        )}
      </View>

      {notifications.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="notifications-off-outline" size={48} color={COLORS.textSecondary} />
          <Text style={styles.emptyTitle}>No notifications yet</Text>
          <Text style={styles.emptySub}>
            Order updates will show up here.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {notifications.map((n) => (
            <NotificationRow key={n.id} n={n} onPress={() => openOrder(n.orderId)} />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function NotificationRow({ n, onPress }: { n: Notification; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={onPress}>
      <View style={[styles.dot, n.read ? styles.dotRead : styles.dotUnread]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.cardTitle}>{n.title}</Text>
        <Text style={styles.cardBody}>{n.body}</Text>
        <Text style={styles.cardTime}>{formatRelative(n.timestamp)}</Text>
      </View>
      {n.orderId && <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />}
    </TouchableOpacity>
  );
}

function formatRelative(iso: string): string {
  try {
    const then = new Date(iso).getTime();
    const diff = Math.max(0, Math.floor((Date.now() - then) / 1000));
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return new Date(iso).toLocaleString();
  } catch { return ''; }
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
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyTitle: { fontSize: SIZES.bodySize, fontWeight: '600', color: COLORS.text, marginTop: 12 },
  emptySub: { fontSize: SIZES.smallSize, color: COLORS.textSecondary, marginTop: 4, textAlign: 'center' },
  list: { padding: SIZES.screenPadding, paddingBottom: 32 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    gap: 10,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotUnread: { backgroundColor: COLORS.primary },
  dotRead: { backgroundColor: COLORS.border },
  cardTitle: { fontSize: SIZES.captionSize, fontWeight: '600', color: COLORS.text },
  cardBody: { fontSize: SIZES.smallSize, color: COLORS.textSecondary, marginTop: 2 },
  cardTime: { fontSize: SIZES.tinySize, color: COLORS.textSecondary, marginTop: 4 },
});
