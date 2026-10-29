// v2.0 FR-5.5 — the shop's sales by item: per-item list, item trends and the
// dashboard's all-items chart.
import { API_BASE_URL } from '../constants/api';

export interface ItemSales {
  itemId: string;
  name: string;
  category?: string;
  unitsSold: number;
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

export interface SalesSeries {
  itemId: string;
  name: string;
  units: number[];
  total: number;
}

export interface SalesChart {
  range: '7d' | '4w';
  labels: string[];
  /** Best seller first. */
  series: SalesSeries[];
}

function authHeaders(token: string) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

async function get<T>(url: string, token: string, fallback: string): Promise<T> {
  const res = await fetch(url, { headers: authHeaders(token) });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(json.error || fallback);
  return json;
}

const BASE = `${API_BASE_URL}/api/shops/sales/items`;

export const ItemSalesService = {
  list(range: 'today' | 'week', token: string): Promise<ItemSales[]> {
    return get(`${BASE}?range=${range}`, token, 'Failed to load sales by item');
  },

  trend(itemId: string, period: 'daily' | 'weekly', token: string): Promise<ItemTrend> {
    return get(`${BASE}/${itemId}/trend?period=${period}`, token, 'Failed to load trend');
  },

  chart(range: '7d' | '4w', token: string): Promise<SalesChart> {
    return get(`${BASE}/chart?range=${range}`, token, 'Failed to load the sales chart');
  },
};
