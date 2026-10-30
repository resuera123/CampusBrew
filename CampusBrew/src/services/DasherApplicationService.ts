// Become a Dasher (customer side) and the customer ⇄ dasher switch.
import { API_BASE_URL } from '../constants/api';
import type { AuthResponse } from './AuthService';

export type ApplicationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface DasherStatus {
  verified: boolean;
  dasherApproved: boolean;
  applicationStatus?: ApplicationStatus | null;
  rejectionReason?: string | null;
  appliedAt?: string | null;
}

export interface DasherApplicationInput {
  phoneNumber: string;
  reason: string;
  course: string;
  yearLevel: number;
  emergencyName: string;
  emergencyRelationship: string;
  emergencyPhone: string;
  agreedToRules: boolean;
  /** Downscaled JPEG data URIs. */
  idPhoto: string;
  selfiePhoto: string;
  corPhoto: string;
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

export const DasherApplicationService = {
  async status(token: string): Promise<DasherStatus> {
    const res = await fetch(`${API_BASE_URL}/api/users/me/dasher-application`, { headers: authHeaders(token) });
    return parse(res, 'Failed to load dasher status');
  },

  async apply(input: DasherApplicationInput, token: string): Promise<DasherStatus> {
    const res = await fetch(`${API_BASE_URL}/api/users/me/dasher-application`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(input),
    });
    return parse(res, 'Could not submit your application');
  },

  /** Returns a fresh session for the other side. */
  async switchRole(role: 'CUSTOMER' | 'DELIVERY_PERSONNEL', token: string): Promise<AuthResponse> {
    const res = await fetch(`${API_BASE_URL}/api/users/me/role`, {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify({ role }),
    });
    return parse(res, 'Could not switch');
  },
};
