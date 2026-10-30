// Admin console: dasher applications, user reports and suspensions.
import { API_BASE_URL } from '../constants/api';
import type { ApplicationStatus } from './DasherApplicationService';

export interface AdminApplication {
  id: string;
  userId: string;
  fullName?: string | null;
  email?: string | null;
  schoolEmail?: string | null;
  studentId?: string | null;
  verificationStatus?: string | null;
  phoneNumber: string;
  reason: string;
  course: string;
  yearLevel: number;
  emergencyName: string;
  emergencyRelationship: string;
  emergencyPhone: string;
  agreedToRules: boolean;
  /** Only on the detail view. */
  idPhoto?: string | null;
  selfiePhoto?: string | null;
  corPhoto?: string | null;
  status: ApplicationStatus;
  rejectionReason?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
}

export type ReportStatus = 'OPEN' | 'RESOLVED';

export interface AdminReport {
  id: string;
  type: 'CHAT' | 'PAYMENT';
  status: ReportStatus;
  createdAt: string;
  resolvedAt?: string | null;
  reporterId?: string | null;
  reporterName?: string | null;
  orderId?: string | null;
  channel?: 'SHOP' | 'DASHER' | null;
  paymentId?: string | null;
  note?: string | null;
  // Detail view only:
  messages?: { senderName: string; senderRole?: string; text: string; createdAt: string }[];
  payment?: {
    amount: number;
    type?: string;
    method?: string;
    status?: string;
    referenceNo?: string | null;
    createdAt?: string;
  } | null;
  people?: { userId: string; name: string; role: string; reporter: boolean; suspended: boolean }[];
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

const base = `${API_BASE_URL}/api/admin`;

export const AdminService = {
  async applications(status: ApplicationStatus | 'ALL', token: string): Promise<AdminApplication[]> {
    const res = await fetch(`${base}/applications?status=${status}`, { headers: authHeaders(token) });
    return parse(res, 'Failed to load applications');
  },

  async application(id: string, token: string): Promise<AdminApplication> {
    const res = await fetch(`${base}/applications/${id}`, { headers: authHeaders(token) });
    return parse(res, 'Failed to load the application');
  },

  async approve(id: string, token: string): Promise<AdminApplication> {
    const res = await fetch(`${base}/applications/${id}/approve`, { method: 'PUT', headers: authHeaders(token) });
    return parse(res, 'Could not approve');
  },

  async reject(id: string, reason: string, token: string): Promise<AdminApplication> {
    const res = await fetch(`${base}/applications/${id}/reject`, {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify({ reason }),
    });
    return parse(res, 'Could not reject');
  },

  async reports(status: ReportStatus | 'ALL', token: string): Promise<AdminReport[]> {
    const res = await fetch(`${base}/reports?status=${status}`, { headers: authHeaders(token) });
    return parse(res, 'Failed to load reports');
  },

  async report(id: string, token: string): Promise<AdminReport> {
    const res = await fetch(`${base}/reports/${id}`, { headers: authHeaders(token) });
    return parse(res, 'Failed to load the report');
  },

  async resolve(id: string, token: string): Promise<AdminReport> {
    const res = await fetch(`${base}/reports/${id}/resolve`, { method: 'PUT', headers: authHeaders(token) });
    return parse(res, 'Could not resolve');
  },

  async suspend(userId: string, reason: string, token: string): Promise<void> {
    const res = await fetch(`${base}/users/${userId}/suspend`, {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify({ reason }),
    });
    await parse(res, 'Could not suspend');
  },

  async unsuspend(userId: string, token: string): Promise<void> {
    const res = await fetch(`${base}/users/${userId}/unsuspend`, { method: 'PUT', headers: authHeaders(token) });
    await parse(res, 'Could not lift the suspension');
  },
};
