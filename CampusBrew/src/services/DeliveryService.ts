import { API_BASE_URL } from '../constants/api';
import { Order } from './OrderService';

export type DayOfWeek =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY'
  | 'SUNDAY';

export interface DaySchedule {
  dayOfWeek: DayOfWeek;
  enabled: boolean;
  startTime: string; // "HH:mm"
  endTime: string;   // "HH:mm"
}

export interface EarningsTotal {
  totalEarnings: number;
  totalDeliveries: number;
  incentiveActive: boolean;
}

export interface DeliveryPersonnelProfile {
  id: string;
  userId: string;
  isActive: boolean;
  longitude?: number | null;
  latitude?: number | null;
  locationUpdatedAt?: string | null;
  weeklySchedule?: DaySchedule[] | null;
  totalDeliveries: number;
  incentiveActive: boolean;
  currentOrderId?: string | null;
}

async function safeJson(res: Response): Promise<any> {
  const text = await res.text();
  if (!text) throw new Error('Server returned an empty response');
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Server error: unexpected response');
  }
}

function authHeaders(token: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export const DeliveryService = {
  async getMyEarningsTotal(token: string): Promise<EarningsTotal> {
    const res = await fetch(`${API_BASE_URL}/api/delivery/earnings/total`, {
      headers: authHeaders(token),
    });
    const json = await safeJson(res);
    if (!res.ok) throw new Error(json.error || 'Failed to load earnings total');
    return json;
  },

  async getMyProfile(token: string): Promise<DeliveryPersonnelProfile> {
    const res = await fetch(`${API_BASE_URL}/api/delivery/me`, {
      headers: authHeaders(token),
    });
    const json = await safeJson(res);
    if (!res.ok) throw new Error(json.error || 'Failed to load delivery profile');
    return json;
  },

  async setAvailability(isActive: boolean, token: string): Promise<DeliveryPersonnelProfile> {
    const res = await fetch(`${API_BASE_URL}/api/delivery/availability`, {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify({ isActive }),
    });
    const json = await safeJson(res);
    if (!res.ok) throw new Error(json.error || 'Failed to update availability');
    return json;
  },

  async updateSchedule(schedule: DaySchedule[], token: string): Promise<DeliveryPersonnelProfile> {
    const res = await fetch(`${API_BASE_URL}/api/delivery/schedule`, {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify({ schedule }),
    });
    const json = await safeJson(res);
    if (!res.ok) throw new Error(json.error || 'Failed to update schedule');
    return json;
  },

  async updateLocation(longitude: number, latitude: number, token: string): Promise<DeliveryPersonnelProfile> {
    const res = await fetch(`${API_BASE_URL}/api/delivery/location`, {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify({ longitude, latitude }),
    });
    const json = await safeJson(res);
    if (!res.ok) throw new Error(json.error || 'Failed to update location');
    return json;
  },

  async acceptAssignment(orderId: string, token: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/delivery/assignments/${orderId}/accept`, {
      method: 'PUT',
      headers: authHeaders(token),
    });
    if (!res.ok) {
      const json = await safeJson(res);
      throw new Error(json.error || 'Failed to accept assignment');
    }
  },

  async declineAssignment(orderId: string, token: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/delivery/assignments/${orderId}/decline`, {
      method: 'PUT',
      headers: authHeaders(token),
    });
    if (!res.ok) {
      const json = await safeJson(res);
      throw new Error(json.error || 'Failed to decline assignment');
    }
  },

  // ─── History ───
  async getDeliveryHistory(token: string): Promise<Order[]> {
    const res = await fetch(`${API_BASE_URL}/api/delivery/orders/history`, {
      headers: authHeaders(token),
    });
    const json = await safeJson(res);
    if (!res.ok) throw new Error(json.error || 'Failed to load delivery history');
    return json;
  },

  // ─── Marketplace ───
  async getAvailableDeliveries(token: string): Promise<Order[]> {
    const res = await fetch(`${API_BASE_URL}/api/delivery/orders/available`, {
      headers: authHeaders(token),
    });
    const json = await safeJson(res);
    if (!res.ok) throw new Error(json.error || 'Failed to load available deliveries');
    return json;
  },

  async claimOrder(orderId: string, token: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/delivery/assignments/${orderId}/claim`, {
      method: 'PUT',
      headers: authHeaders(token),
    });
    if (!res.ok) {
      const json = await safeJson(res);
      throw new Error(json.error || 'Failed to claim order');
    }
  },

  // ─── Module 3 §3.3 — Pickup & Delivery ───
  async getCurrentOrder(token: string): Promise<Order | null> {
    const res = await fetch(`${API_BASE_URL}/api/delivery/orders/current`, {
      headers: authHeaders(token),
    });
    if (res.status === 404) return null;
    const json = await safeJson(res);
    if (!res.ok) throw new Error(json.error || 'Failed to load current order');
    return json;
  },

  async markPickedUp(orderId: string, token: string): Promise<Order> {
    const res = await fetch(`${API_BASE_URL}/api/delivery/orders/${orderId}/pickup`, {
      method: 'PUT',
      headers: authHeaders(token),
    });
    const json = await safeJson(res);
    if (!res.ok) throw new Error(json.error || 'Failed to mark picked up');
    return json;
  },

  async confirmDelivery(orderId: string, token: string): Promise<Order> {
    const res = await fetch(`${API_BASE_URL}/api/delivery/orders/${orderId}/complete`, {
      method: 'PUT',
      headers: authHeaders(token),
    });
    const json = await safeJson(res);
    if (!res.ok) throw new Error(json.error || 'Failed to confirm delivery');
    return json;
  },
};
