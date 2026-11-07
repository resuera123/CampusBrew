import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';
import * as Notifications from 'expo-notifications';
import { registerPushToken, showNewOrderAlert, prepareNewOrderAlerts } from '../services/push';
import { navigate } from '../navigation/navigationRef';

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
/**
 * The shop operator's view of an order update, or null for steps the shop did
 * itself (accepting, marking ready), which don't need a notification.
 */
function describeShopUpdate(status: string, orderId?: string, deliveryPersonnel?: { fullName?: string }) {
  const short = orderId ? `Order #${orderId.slice(-6).toUpperCase()}` : 'An order';
  switch (status) {
    case 'PLACED':
      return { title: 'New order received', body: `${short} is waiting. Open Orders to accept it.` };
    case 'ASSIGNED':
      return {
        title: 'Dasher assigned',
        body: deliveryPersonnel?.fullName
          ? `${deliveryPersonnel.fullName} is coming to pick up ${short.toLowerCase()}.`
          : `A dasher is coming to pick up ${short.toLowerCase()}.`,
      };
    case 'DELIVERED':
      return { title: 'Order delivered', body: `${short} reached the customer.` };
    case 'CANCELLED':
      return { title: 'Order cancelled', body: `${short} was cancelled.` };
    default:
      return null;
  }
}

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
  const { user, token } = useAuth();
  const { socket } = useSocket();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Reset when user changes (login / logout).
  useEffect(() => {
    setNotifications([]);
  }, [user?.userId]);

  // v2.0 FR-3.4 — register this device for push on login; tap routes to the order.
  useEffect(() => {
    if (!user || !token) return;
    registerPushToken(token);
    if (user.role === 'SHOP_OPERATOR') prepareNewOrderAlerts();

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as
        { orderId?: string; type?: string; channel?: string } | undefined;
      // A dasher application or verification decision opens the customer's profile.
      if (data?.type === 'application' || data?.type === 'verification') {
        navigate('CustomerTabs', { screen: 'Profile' });
        return;
      }
      // A shop application decision opens the shop dashboard.
      if (data?.type === 'shop-application') {
        navigate('ShopTabs', { screen: 'ShopDashboard' });
        return;
      }
      const orderId = data?.orderId;
      if (!orderId) return;
      // v2.0 FR-3.5 — a chat push opens that conversation for every role.
      if (data?.type === 'chat') {
        navigate('Chat', { orderId, channel: data.channel });
        return;
      }
      // v2.0 FR-3.6 — a rating prompt opens the rating screen.
      if (data?.type === 'rating') {
        navigate('RateOrder', { orderId });
        return;
      }
      // v2.0 FR-4.7 — a tip push opens the dasher's delivery history.
      if (data?.type === 'tip') {
        navigate('DeliveryHistory');
        return;
      }
      // Route to the role-appropriate screen for this order.
      if (user.role === 'DELIVERY_PERSONNEL') {
        navigate('AssignedDelivery', { orderId });
      } else if (user.role === 'SHOP_OPERATOR') {
        navigate('OrderQueue');
      } else {
        navigate('OrderTracking', { orderId });
      }
    });
    return () => sub.remove();
  }, [user?.userId, token]);

  useEffect(() => {
    if (!socket) return;

    const push = (n: Omit<Notification, 'id' | 'read'>) => {
      setNotifications((prev) => [
        { ...n, id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, read: false },
        ...prev,
      ].slice(0, 100)); // cap to last 100 to keep memory bounded
    };

    const isShop = user?.role === 'SHOP_OPERATOR';

    const onStatusUpdate = (payload: any) => {
      const { status, orderId, deliveryPersonnel, timestamp, reason, paymentStatus } = payload ?? {};
      if (!status) return;
      const short = orderId ? `Order #${String(orderId).slice(-6).toUpperCase()}` : 'Your order';
      // Auto-cancelled because no dasher claimed it in time.
      const expired = status === 'CANCELLED' && reason === 'expired';
      const described = expired
        ? {
            title: 'No rider available',
            body: isShop
              ? `No dasher picked up ${short.toLowerCase()}, so it was cancelled.`
              : `No dasher was free, so ${short.toLowerCase()} was cancelled.${
                  paymentStatus === 'REFUNDED' || paymentStatus === 'REFUND_PENDING'
                    ? ' Your GCash payment is being refunded.'
                    : ''}`,
          }
        : isShop
        ? describeShopUpdate(status, orderId, deliveryPersonnel)
        : describeStatusUpdate(status, orderId, deliveryPersonnel);
      if (!described) return;
      const { title, body } = described;
      // A new order also pops up on the phone with sound, so the shop notices it.
      if (isShop && status === 'PLACED') showNewOrderAlert(title, body, orderId);
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

    // v2.0 FR-4.7 — a customer tipped the dasher after delivery.
    const onTipReceived = (payload: any) => {
      const amount = Number(payload?.amount ?? 0);
      push({
        title: `You got a ₱${amount.toFixed(0)} tip!`,
        body: `For order #${(payload?.orderId ?? '').slice(-6).toUpperCase()} — 100% yours.`,
        orderId: payload?.orderId,
        timestamp: new Date().toISOString(),
      });
    };

    // The shop hears about deliveries through their own event, not order:statusUpdate.
    const onShopDelivered = (payload: any) => {
      if (!isShop) return;
      const described = describeShopUpdate('DELIVERED', payload?.orderId);
      if (described) push({ ...described, orderId: payload?.orderId, timestamp: new Date().toISOString() });
    };

    socket.on('order:statusUpdate', onStatusUpdate);
    socket.on('order:delivered', onShopDelivered);
    socket.on('delivery:request', onDeliveryRequest);
    socket.on('order:noDriver', onNoDriver);
    socket.on('tip:received', onTipReceived);

    return () => {
      socket.off('order:statusUpdate', onStatusUpdate);
      socket.off('order:delivered', onShopDelivered);
      socket.off('delivery:request', onDeliveryRequest);
      socket.off('order:noDriver', onNoDriver);
      socket.off('tip:received', onTipReceived);
    };
  }, [socket, user?.role]);

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
