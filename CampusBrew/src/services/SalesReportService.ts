// v2.0 FR-4.6 — the shop's daily / weekly sales report.
import { API_BASE_URL } from '../constants/api';

export type ReportRange = 'day' | 'week';

export interface SalesReport {
  range: ReportRange;
  offset: number;
  label: string;
  sales: number;
  orders: number;
  avgOrder: number;
  prevSales: number;
  prevOrders: number;
  prevAvgOrder: number;
  cancelledOrders: number;
  cancelledSales: number;
  refundedOrders: number;
  buckets: { label: string; sales: number; orders: number }[];
  peakLabel?: string | null;
  gcashSales: number;
  gcashOrders: number;
  codSales: number;
  codOrders: number;
  topItems: { itemId: string; itemName: string; qty: number }[];
  orderList: { orderId: string; deliveredAt: string; items: string; amount: number; paymentMethod?: string }[];
}

export const SalesReportService = {
  async report(range: ReportRange, offset: number, token: string): Promise<SalesReport> {
    const res = await fetch(`${API_BASE_URL}/api/shops/sales/report?range=${range}&offset=${offset}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const text = await res.text();
    const json = text ? JSON.parse(text) : {};
    if (!res.ok) throw new Error(json.error || 'Failed to load the sales report');
    return json;
  },
};
