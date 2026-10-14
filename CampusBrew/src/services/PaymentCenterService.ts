// v2.0 FR-4.8 — Payment Center client.
import { API_BASE_URL } from '../constants/api';

export interface PaymentCenterEntry {
  id: string;
  source: 'PAYMENT' | 'TRANSACTION' | 'COD_ORDER';
  kind: 'ORDER' | 'TIP' | 'DELIVERY' | 'SHOP_RECEIPT';
  orderId?: string | null;
  method?: 'GCASH' | 'COD' | null;
  status: string;
  amount: number;
  referenceNo?: string | null;
  description?: string;
  reported?: boolean;
  createdAt: string;
}

export interface PaymentCenter {
  role: 'CUSTOMER' | 'DELIVERY_PERSONNEL' | 'SHOP_OPERATOR';
  summary: Record<string, number>;
  entries: PaymentCenterEntry[];
}

function authHeaders(token: string) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

export const PaymentCenterService = {
  async get(token: string, type?: 'ORDER' | 'TIP'): Promise<PaymentCenter> {
    const q = type ? `?type=${type}` : '';
    const res = await fetch(`${API_BASE_URL}/api/payments/me${q}`, { headers: authHeaders(token) });
    const text = await res.text();
    const json = text ? JSON.parse(text) : {};
    if (!res.ok) throw new Error(json.error || 'Failed to load Payment Center');
    return json;
  },

  async report(paymentId: string, note: string, token: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/payments/${paymentId}/report`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ note }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error((text && JSON.parse(text).error) || 'Failed to report');
    }
  },
};
