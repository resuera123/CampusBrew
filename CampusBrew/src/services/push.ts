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
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

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
