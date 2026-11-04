import { API_BASE_URL } from '../constants/api';

export type SupportTopic = 'APPEAL' | 'QUESTION' | 'OTHER';

/** Contact Support from the login screen; no account or token needed. */
export const SupportService = {
  /** Returns the ticket's reference number, e.g. SUP-0004. */
  async submit(data: { email: string; name?: string; topic: SupportTopic; message: string }): Promise<string> {
    const res = await fetch(`${API_BASE_URL}/api/support`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const text = await res.text();
    let json: any = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      // fall through to the generic message
    }
    if (!res.ok) throw new Error(json.error || 'Could not send your message');
    return json.ref ?? '';
  },
};
