import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';

export interface Notification {
  id: string;
  title: string;
  body: string;
  orderId?: string;
  timestamp: string;
  read: boolean;
}

interface NotificationsContextType {
  notifications: Notification[];
  unreadCount: number;
  markAllRead: () => void;
  clear: () => void;
}

const NotificationsContext = createContext<NotificationsContextType>({
  notifications: [],
  unreadCount: 0,
  markAllRead: () => {},
  clear: () => {},
});

/** Maps a server status string to a user-friendly title/body for the notification feed. */
function describeStatusUpdate(status: string, orderId?: string, deliveryPersonnel?: { fullName?: string }) {
  const short = orderId ? `Order #${orderId.slice(-6).toUpperCase()}` : 'Your order';
  switch (status) {
    case 'PLACED':
      return { title: 'Order placed', body: `${short} was sent to the shop.` };
    case 'PREPARING':
      return { title: 'Order is being prepared', body: `${short} — the shop is making your drinks.` };
    case 'READY_FOR_PICKUP':
      return { title: 'Ready for pickup', body: `${short} is ready and waiting for a rider.` };
    case 'ASSIGNED':
      return {
        title: 'Rider assigned',
        body: deliveryPersonnel?.fullName
          ? `${deliveryPersonnel.fullName} is picking up ${short.toLowerCase()}.`
          : `A rider is on the way to the shop for ${short.toLowerCase()}.`,
      };
    case 'OUT_FOR_DELIVERY':
      return { title: 'Order picked up', body: `${short} is on the way to you.` };
    case 'DELIVERED':
      return { title: 'Delivered', body: `${short} has arrived. Enjoy!` };
    case 'CANCELLED':
      return { title: 'Order cancelled', body: `${short} was cancelled.` };
    default:
      return { title: 'Order update', body: `${short} status: ${status}` };
  }
}

export const NotificationsProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Reset when user changes (login / logout).
  useEffect(() => {
    setNotifications([]);
  }, [user?.userId]);

  useEffect(() => {
    if (!socket) return;

    const push = (n: Omit<Notification, 'id' | 'read'>) => {
      setNotifications((prev) => [
        { ...n, id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, read: false },
        ...prev,
      ].slice(0, 100)); // cap to last 100 to keep memory bounded
    };

    const onStatusUpdate = (payload: any) => {
      const { status, orderId, deliveryPersonnel, timestamp } = payload ?? {};
      if (!status) return;
      const { title, body } = describeStatusUpdate(status, orderId, deliveryPersonnel);
      push({
        title,
        body,
        orderId,
        timestamp: timestamp ?? new Date().toISOString(),
      });
    };

    const onDeliveryRequest = (payload: any) => {
      // For DPs: incoming offer notification (the modal still pops up; this is just the
      // archived record of having received it).
      push({
        title: 'New delivery offer',
        body: payload?.shopName
          ? `${payload.shopName} → ${payload.deliveryLocation ?? 'a campus drop-off'}`
          : 'A new delivery is available for you.',
        orderId: payload?.orderId,
        timestamp: new Date().toISOString(),
      });
    };

    const onNoDriver = (payload: any) => {
      push({
        title: 'Looking for a rider',
        body: `Order #${(payload?.orderId ?? '').slice(-6).toUpperCase()} doesn't have a rider yet — we're still looking.`,
        orderId: payload?.orderId,
        timestamp: new Date().toISOString(),
      });
    };

    socket.on('order:statusUpdate', onStatusUpdate);
    socket.on('delivery:request', onDeliveryRequest);
    socket.on('order:noDriver', onNoDriver);

    return () => {
      socket.off('order:statusUpdate', onStatusUpdate);
      socket.off('delivery:request', onDeliveryRequest);
      socket.off('order:noDriver', onNoDriver);
    };
  }, [socket]);

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const clear = () => setNotifications([]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationsContext.Provider value={{ notifications, unreadCount, markAllRead, clear }}>
      {children}
    </NotificationsContext.Provider>
  );
};

export const useNotifications = () => useContext(NotificationsContext);
