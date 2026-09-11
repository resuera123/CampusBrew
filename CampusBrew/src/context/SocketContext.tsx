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

  constructor(private url: string, private onStatus: (connected: boolean) => void) {
    this.connect();
  }

  private connect() {
    const ws = new WebSocket(this.url);
    this.ws = ws;

    ws.onopen = () => {
      this.retries = 0;
      this.onStatus(true);
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

  private send(event: string, room: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ event, room }));
    }
  }

  /** Subscribe to updates for one order, in addition to this user's own feed. */
  joinOrder(orderId: string) {
    this.send('join', `order:${orderId}`);
  }

  leaveOrder(orderId: string) {
    this.send('leave', `order:${orderId}`);
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
