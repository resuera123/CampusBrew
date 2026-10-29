// v2.0 FR-5.5 — shop inventory movement and sales trends client.
import { API_BASE_URL } from '../constants/api';

export interface InventoryItem {
  itemId: string;
  name: string;
  category?: string;
  unitsSold: number;
  stockTracking: boolean;
  stockQty?: number | null;
  lowStockLevel?: number | null;
  lowStock: boolean;
  isAvailable: boolean;
}

export interface TrendPoint {
  label: string;
  units: number;
}

export interface ItemTrend {
  itemId: string;
  itemName: string;
  period: 'daily' | 'weekly';
  points: TrendPoint[];
  thisWeek: number;
  lastWeek: number;
  changePct?: number | null;
  bestSellers: string[];
  slowest: string[];
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

const BASE = `${API_BASE_URL}/api/shops/inventory`;

export const InventoryService = {
  async list(range: 'today' | 'week', token: string): Promise<InventoryItem[]> {
    const res = await fetch(`${BASE}?range=${range}`, { headers: authHeaders(token) });
    return parse<InventoryItem[]>(res, 'Failed to load inventory');
  },

  async trend(itemId: string, period: 'daily' | 'weekly', token: string): Promise<ItemTrend> {
    const res = await fetch(`${BASE}/${itemId}/trend?period=${period}`, { headers: authHeaders(token) });
    return parse<ItemTrend>(res, 'Failed to load trend');
  },

  async restock(itemId: string, quantity: number, token: string): Promise<InventoryItem> {
    const res = await fetch(`${BASE}/${itemId}/restock`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ quantity }),
    });
    return parse<InventoryItem>(res, 'Failed to restock');
  },

  async setTracking(
    itemId: string,
    body: { enabled: boolean; quantity?: number; lowStockLevel?: number },
    token: string,
  ): Promise<InventoryItem> {
    const res = await fetch(`${BASE}/${itemId}/tracking`, {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify(body),
    });
    return parse<InventoryItem>(res, 'Failed to update stock tracking');
  },
};
