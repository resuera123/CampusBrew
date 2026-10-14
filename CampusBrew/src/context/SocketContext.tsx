import React, { createContext, useContext, useEffect, useState } from 'react';
import { SOCKET_URL } from '../constants/api';
import { useAuth } from './AuthContext';

type Handler = (payload: any) => void;

/**
 * Minimal event-emitter over a plain WebSocket.
 *
 * Keeps the `on` / `off` surface the screens already use, so swapping the
 * backend off Socket.IO (which needed its own port) changed nothing for them.
 */
export class RealtimeSocket {
  private ws: WebSocket | null = null;
  private handlers = new Map<string, Set<Handler>>();
  private retries = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;
  // Frames emitted while the socket is down are queued and flushed on open, so a
  // chat message or location ping sent mid-reconnect isn't silently dropped (NFR-R4).
  private outbox: string[] = [];

  constructor(private url: string, private onStatus: (connected: boolean) => void) {
    this.connect();
  }

  private connect() {
    const ws = new WebSocket(this.url);
    this.ws = ws;

    ws.onopen = () => {
      this.retries = 0;
      this.onStatus(true);
      const pending = this.outbox;
      this.outbox = [];
      pending.forEach((frame) => ws.send(frame));
    };

    ws.onmessage = (e) => {
      try {
        const { event, data } = JSON.parse(e.data as string);
        this.handlers.get(event)?.forEach((h) => h(data));
      } catch {
        // Ignore frames that aren't our JSON envelope.
      }
    };

    ws.onerror = () => {
      // A close always follows, which is where reconnection is handled.
    };

    ws.onclose = () => {
      this.onStatus(false);
      this.scheduleReconnect();
    };
  }

  private scheduleReconnect() {
    if (this.closed) return;
    // Exponential backoff capped at 10s, so a sleeping server doesn't get hammered.
    const delay = Math.min(1000 * 2 ** this.retries++, 10000);
    this.timer = setTimeout(() => this.connect(), delay);
  }

  on(event: string, handler: Handler) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(handler);
  }

  off(event: string, handler: Handler) {
    this.handlers.get(event)?.delete(handler);
  }

  private sendFrame(frame: Record<string, unknown>) {
    const text = JSON.stringify(frame);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(text);
    } else if (!this.closed) {
      this.outbox.push(text);
    }
  }

  /**
   * Send a domain event to the server, e.g. emit('chat:send', { orderId, channel, text }).
   * The server trusts the authenticated identity from the handshake, not this payload.
   */
  emit(event: string, data?: unknown) {
    this.sendFrame({ event, data });
  }

  /** Subscribe to updates for one order, in addition to this user's own feed. */
  joinOrder(orderId: string) {
    this.sendFrame({ event: 'join', room: `order:${orderId}` });
  }

  leaveOrder(orderId: string) {
    this.sendFrame({ event: 'leave', room: `order:${orderId}` });
  }

  close() {
    this.closed = true;
    if (this.timer) clearTimeout(this.timer);
    this.ws?.close();
  }
}

interface SocketContextType {
  socket: RealtimeSocket | null;
  connected: boolean;
}

const SocketContext = createContext<SocketContextType>({ socket: null, connected: false });

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const { token } = useAuth();
  const [socket, setSocket] = useState<RealtimeSocket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!token) {
      setSocket(null);
      setConnected(false);
      return;
    }

    // JWT travels as a URL query param so the handshake interceptor can reject
    // the upgrade before a session is ever opened.
    const next = new RealtimeSocket(
      `${SOCKET_URL}?token=${encodeURIComponent(token)}`,
      setConnected,
    );

    setSocket(next);

    return () => {
      next.close();
      setSocket(null);
      setConnected(false);
    };
  }, [token]);

  return (
    <SocketContext.Provider value={{ socket, connected }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
