// Shop approval: the operator's application to open their shop to customers.
import { API_BASE_URL } from '../constants/api';
import type { ApplicationStatus } from './DasherApplicationService';

export interface ShopApprovalStatus {
  approved: boolean;
  applicationStatus?: ApplicationStatus | null;
  rejectionReason?: string | null;
  appliedAt?: string | null;
}

export interface ShopApplicationInput {
  stallName: string;
  location: string;
  operatorName: string;
  phoneNumber: string;
  agreedToRules: boolean;
  /** Downscaled JPEG data URIs. */
  stallPhoto: string;
  idPhoto: string;
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

export const ShopApplicationService = {
  async status(token: string): Promise<ShopApprovalStatus> {
    const res = await fetch(`${API_BASE_URL}/api/users/me/shop-application`, { headers: authHeaders(token) });
    return parse(res, 'Failed to load the shop approval status');
  },

  async apply(input: ShopApplicationInput, token: string): Promise<ShopApprovalStatus> {
    const res = await fetch(`${API_BASE_URL}/api/users/me/shop-application`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(input),
    });
    return parse(res, 'Could not submit your application');
  },
};
