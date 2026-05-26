import { API_BASE_URL } from '../constants/api';
import { Order, OrderStatus } from './OrderService';

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

export const ShopOrderService = {
  async getQueue(shopId: string, statuses: OrderStatus[], token: string): Promise<Order[]> {
    const statusParam = statuses.length > 0 ? `?status=${statuses.join(',')}` : '';
    const res = await fetch(
      `${API_BASE_URL}/api/shops/${shopId}/orders${statusParam}`,
      { headers: authHeaders(token) },
    );
    const json = await safeJson(res);
    if (!res.ok) throw new Error(json.error || 'Failed to load orders');
    return json;
  },

  async accept(orderId: string, token: string): Promise<Order> {
    const res = await fetch(`${API_BASE_URL}/api/shops/orders/${orderId}/accept`, {
      method: 'PUT',
      headers: authHeaders(token),
    });
    const json = await safeJson(res);
    if (!res.ok) throw new Error(json.error || 'Failed to accept order');
    return json;
  },

  async reject(orderId: string, token: string): Promise<Order> {
    const res = await fetch(`${API_BASE_URL}/api/shops/orders/${orderId}/reject`, {
      method: 'PUT',
      headers: authHeaders(token),
    });
    const json = await safeJson(res);
    if (!res.ok) throw new Error(json.error || 'Failed to reject order');
    return json;
  },

  async markReady(orderId: string, token: string): Promise<Order> {
    const res = await fetch(`${API_BASE_URL}/api/shops/orders/${orderId}/ready`, {
      method: 'PUT',
      headers: authHeaders(token),
    });
    const json = await safeJson(res);
    if (!res.ok) throw new Error(json.error || 'Failed to mark order ready');
    return json;
  },
};
