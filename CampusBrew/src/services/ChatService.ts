// v2.0 FR-3.5 — in-app chat client. History and reporting go over REST; messages
// are sent and received over the socket ("chat:send" / "chat:message").
import { API_BASE_URL } from '../constants/api';

export type ChatChannel = 'SHOP' | 'DASHER';

export interface ChatMessage {
  id: string;
  clientId?: string | null;
  orderId: string;
  channel: ChatChannel;
  senderId: string;
  senderRole: string;
  text: string;
  readAt?: string | null;
  createdAt: string;
}

export interface ChatHistory {
  orderId: string;
  channel: ChatChannel;
  counterpartName: string;
  writable: boolean;
  closedReason?: string | null;
  reported: boolean;
  messages: ChatMessage[];
}

function authHeaders(token: string) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

export const ChatService = {
  async history(orderId: string, channel: ChatChannel, token: string): Promise<ChatHistory> {
    const res = await fetch(`${API_BASE_URL}/api/orders/${orderId}/chat/${channel}`, {
      headers: authHeaders(token),
    });
    const text = await res.text();
    const json = text ? JSON.parse(text) : {};
    if (!res.ok) throw new Error(json.error || 'Failed to load messages');
    return json;
  },

  async report(orderId: string, channel: ChatChannel, token: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/orders/${orderId}/chat/${channel}/report`, {
      method: 'POST',
      headers: authHeaders(token),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error((text && JSON.parse(text).error) || 'Failed to report');
    }
  },
};
