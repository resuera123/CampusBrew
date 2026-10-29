// v2.0 FR-3.6 — three-way rating client.
import { API_BASE_URL } from '../constants/api';

export type RateeRole = 'CUSTOMER' | 'DELIVERY_PERSONNEL' | 'SHOP';

export interface RatingTarget {
  rateeRole: RateeRole;
  name: string;
  tagOptions: string[];
  allowReview: boolean;
  stars?: number | null;
  tags?: string[] | null;
  review?: string | null;
}

export interface RatingForm {
  orderId: string;
  windowOpen: boolean;
  closesAt?: string | null;
  targets: RatingTarget[];
}

export interface RatingEntry {
  rateeRole: RateeRole;
  stars: number;
  tags: string[];
  review?: string;
}

/**
 * Whether to offer "Rate" for an order delivered at `deliveredAt`. Only a UI hint —
 * the server enforces the real window (rating.windowHours, default 24).
 */
export function ratingWindowLikelyOpen(deliveredAt?: string | null): boolean {
  if (!deliveredAt) return false;
  return Date.now() - new Date(deliveredAt).getTime() < 24 * 60 * 60 * 1000;
}

function authHeaders(token: string) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

async function parse(res: Response, fallback: string): Promise<RatingForm> {
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(json.error || fallback);
  return json;
}

export const RatingService = {
  async form(orderId: string, token: string): Promise<RatingForm> {
    const res = await fetch(`${API_BASE_URL}/api/orders/${orderId}/ratings`, { headers: authHeaders(token) });
    return parse(res, 'Failed to load ratings');
  },

  async submit(orderId: string, ratings: RatingEntry[], token: string): Promise<RatingForm> {
    const res = await fetch(`${API_BASE_URL}/api/orders/${orderId}/ratings`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ ratings }),
    });
    return parse(res, 'Failed to submit ratings');
  },
};
