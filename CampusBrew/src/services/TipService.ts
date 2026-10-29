// v2.0 FR-4.7 — post-delivery tip client. Starting a tip opens a GCash checkout;
// the tip is only recorded once the payment is PAID.
import { API_BASE_URL } from '../constants/api';
import { PaymentService, GcashResult } from './PaymentService';

export interface TipStatus {
  orderId: string;
  canTip: boolean;
  reason?: string | null;
  closesAt?: string | null;
  maxAmount: number;
  presets: number[];
  dasherName?: string | null;
  checkoutTip: number;
  postDeliveryTip: number;
}

function authHeaders(token: string) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

async function parse<T>(res: Response, fallback: string): Promise<T> {
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(json.error || fallback);
  return json;
}

export const TipService = {
  async status(orderId: string, token: string): Promise<TipStatus> {
    const res = await fetch(`${API_BASE_URL}/api/orders/${orderId}/tip`, { headers: authHeaders(token) });
    return parse<TipStatus>(res, 'Failed to load tip');
  },

  /** Starts the GCash charge, opens the checkout, and waits for the payment result. */
  async sendTip(orderId: string, amount: number, token: string): Promise<GcashResult> {
    const res = await fetch(`${API_BASE_URL}/api/orders/${orderId}/tip`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ amount }),
    });
    const charge = await parse<{ paymentId: string; paymentUrl: string }>(res, 'Failed to start the tip');
    return PaymentService.payWithGcash(charge, token);
  },
};
