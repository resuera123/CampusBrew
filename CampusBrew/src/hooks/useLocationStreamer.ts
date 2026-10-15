import { useEffect } from 'react';
import * as Location from 'expo-location';
import type { RealtimeSocket } from '../context/SocketContext';
import type { Order } from '../services/OrderService';

/**
 * v2.0 FR-3.4 — streams the dasher's location while an order is OUT_FOR_DELIVERY.
 * Foreground only; the dasher keeps the app open during delivery. Starts on pickup,
 * emits location:update every 5s, and stops automatically on delivery / unmount.
 */
export function useLocationStreamer(order: Order | null, socket: RealtimeSocket | null) {
  const orderId = order?.id;
  const active = order?.orderStatus === 'OUT_FOR_DELIVERY';

  useEffect(() => {
    if (!active || !orderId || !socket) return;
    let cancelled = false;
    let sub: Location.LocationSubscription | null = null;

    (async () => {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted' || cancelled) return;
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 5000, distanceInterval: 5 },
        (pos) => {
          socket.emit('location:update', {
            orderId,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        },
      );
    })();

    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [orderId, active, socket]);
}
