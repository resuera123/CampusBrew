// v2.0 FR-4.1 — client side of the GCash (Xendit) payment flow.
import * as WebBrowser from 'expo-web-browser';
import { API_BASE_URL } from '../constants/api';
import { OrderService, type Order } from './OrderService';

export type PaymentRecordStatus = 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED' | 'REFUNDED';
export type PaymentType = 'ORDER' | 'TIP';

export interface PaymentView {
  id: string;
  status: PaymentRecordStatus;
  type: PaymentType;
  method: 'GCASH' | 'COD';
  amount: number;
  orderId?: string | null;
  referenceNo?: string | null;
}

export type GcashResult =
  | { status: 'PAID'; orderId: string }
  | { status: 'FAILED' | 'EXPIRED' }
  | { status: 'PENDING' }; // user dismissed the browser before we saw a terminal state

function authHeaders(token: string) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const PaymentService = {
  /** Poll one payment's status (used after opening the GCash checkout). */
  async getPayment(paymentId: string, token: string): Promise<PaymentView> {
    const res = await fetch(`${API_BASE_URL}/api/payments/${paymentId}`, {
      headers: authHeaders(token),
    });
    const text = await res.text();
    const json = text ? JSON.parse(text) : {};
    if (!res.ok) throw new Error(json.error || 'Failed to load payment');
    return json;
  },

  /**
   * Drive a GCash checkout to completion: open the hosted checkout, then poll until
   * the payment reaches a terminal state. The backend only creates the order on PAID,
   * so a PAID result carries the new orderId.
   *
   * @param init the paymentRequired response from OrderService.createOrder
   */
  async payWithGcash(
    init: Pick<Order, 'paymentUrl' | 'paymentId'>,
    token: string,
    opts: { pollIntervalMs?: number; timeoutMs?: number } = {},
  ): Promise<GcashResult> {
    if (!init.paymentUrl || !init.paymentId) {
      throw new Error('Missing checkout URL or payment id');
    }
    const pollIntervalMs = opts.pollIntervalMs ?? 2000;
    const timeoutMs = opts.timeoutMs ?? 15 * 60 * 1000; // matches the server's 15-min expiry

    // Opens an in-app browser tab; resolves when the user returns (redirect or dismiss).
    await WebBrowser.openBrowserAsync(init.paymentUrl);

    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const p = await this.getPayment(init.paymentId, token);
      if (p.status === 'PAID') return { status: 'PAID', orderId: p.orderId as string };
      if (p.status === 'FAILED') return { status: 'FAILED' };
      if (p.status === 'EXPIRED') return { status: 'EXPIRED' };
      await sleep(pollIntervalMs);
    }
    return { status: 'PENDING' };
  },
};

/**
 * Convenience for the checkout screen: create the order, and if it's GCash, run the
 * payment flow. Returns the final order id (COD returns immediately; GCash after PAID).
 */
export async function placeOrderWithPayment(
  req: Parameters<typeof OrderService.createOrder>[0],
  token: string,
): Promise<{ orderId: string } | { status: 'FAILED' | 'EXPIRED' | 'PENDING' }> {
  const created = await OrderService.createOrder(req, token);

  if (!created.paymentRequired) {
    return { orderId: created.id }; // COD — order already exists
  }

  const result = await PaymentService.payWithGcash(created, token);
  return result.status === 'PAID' ? { orderId: result.orderId } : { status: result.status };
}
