import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { API_BASE_URL } from '../constants/api';

/**
 * v2.0 FR-3.4 / NFR-C5 — Expo push registration.
 *
 * Remote push needs a real device and, since Expo SDK 53, a development build
 * (Expo Go on Android no longer supports it). Everything here is best-effort:
 * on a simulator, in Expo Go, or when permission is denied, we quietly return
 * null and the app keeps working off the socket plus the NFR-R3 foreground
 * refresh. We never throw.
 */

// Foreground presentation: show an alert banner even while the app is open.
// A shop's new order is shown by the app itself (showNewOrderAlert, from the
// socket) with sound; the server's push for the same order is skipped while the
// app is open so it doesn't appear twice.
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data as { type?: string; local?: boolean } | undefined;
    const newOrder = data?.type === 'shop-order';
    const duplicate = newOrder && !data?.local;
    return {
      shouldShowBanner: !duplicate,
      shouldShowList: !duplicate,
      shouldPlaySound: newOrder && !duplicate,
      shouldSetBadge: false,
    };
  },
});

const ORDERS_CHANNEL = 'new-orders';
let ordersChannelReady: Promise<boolean> | null = null;

/** Asks for notification permission once and sets up a loud channel for new orders. */
function prepareOrdersChannel(): Promise<boolean> {
  if (!ordersChannelReady) {
    ordersChannelReady = (async () => {
      const { status: existing } = await Notifications.getPermissionsAsync();
      const status = existing === 'granted' ? existing : (await Notifications.requestPermissionsAsync()).status;
      if (status !== 'granted') return false;
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync(ORDERS_CHANNEL, {
          name: 'New orders',
          importance: Notifications.AndroidImportance.HIGH, // heads-up banner + sound
          sound: 'default',
          vibrationPattern: [0, 250, 150, 250],
        });
      }
      return true;
    })().catch(() => false);
  }
  return ordersChannelReady;
}

/**
 * Shows "New order received" on this phone, with sound, when the shop's socket
 * reports a new order. Works in Expo Go (which can't receive the server's push)
 * while the app is open or still running in the background.
 */
export async function showNewOrderAlert(title: string, body: string, orderId?: string): Promise<void> {
  try {
    if (!(await prepareOrdersChannel())) return;
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: 'default', data: { orderId, type: 'shop-order', local: true } },
      trigger: Platform.OS === 'android' ? { channelId: ORDERS_CHANNEL } : null,
    });
  } catch (err) {
    console.log('[push] new-order alert skipped:', (err as Error)?.message ?? err);
  }
}

/** Gets permission up front, so the first new order can alert straight away. */
export function prepareNewOrderAlerts(): void {
  prepareOrdersChannel();
}

async function getExpoPushToken(): Promise<string | null> {
  if (!Device.isDevice) return null; // push tokens aren't issued to simulators

  const { status: existing } = await Notifications.getPermissionsAsync();
  let status = existing;
  if (status !== 'granted') {
    const req = await Notifications.requestPermissionsAsync();
    status = req.status;
  }
  if (status !== 'granted') return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Order updates',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as any).easConfig?.projectId;

  const tokenResponse = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined,
  );
  return tokenResponse.data;
}

/**
 * Registers this device's Expo push token with the backend. Returns the token
 * on success, or null if push isn't available in this environment.
 */
export async function registerPushToken(authToken: string): Promise<string | null> {
  try {
    const expoPushToken = await getExpoPushToken();
    if (!expoPushToken) return null;

    await fetch(`${API_BASE_URL}/api/users/me/push-token`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ token: expoPushToken }),
    });
    return expoPushToken;
  } catch (err) {
    // Expo Go / no dev build / denied permission — fall back to in-app updates.
    console.log('[push] registration skipped:', (err as Error)?.message ?? err);
    return null;
  }
}
