import React, { createContext, useContext, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { SOCKET_URL } from '../constants/api';
import { useAuth } from './AuthContext';

type Handler = (payload: any) => void;

/** How often the app checks the connection is still alive, and how long it waits for the answer. */
const PING_EVERY_MS = 25000;
const PONG_TIMEOUT_MS = 10000;

/**
 * Minimal event-emitter over a plain WebSocket.
 *
 * Keeps the `on` / `off` surface the screens already use, so swapping the
 * backend off Socket.IO (which needed its own port) changed nothing for them.
 *
 * Heartbeat: every 25s it sends {"event":"ping"} and expects {"event":"pong"}.
 * If nothing comes back within 10s the connection has died without closing
 * (laptop sleep, Wi-Fi change, proxy idle timeout), so it is dropped and
 * replaced right away instead of silently swallowing events.
 *
 * After every (re)connect it re-joins the order rooms it was in and fires a
 * local "connect" event, so screens can re-fetch anything they missed.
 */
export class RealtimeSocket {
  private ws: WebSocket | null = null;
  private handlers = new Map<string, Set<Handler>>();
  private retries = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private pongTimer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;
  // Frames emitted while the socket is down are queued and flushed on open, so a
  // chat message or location ping sent mid-reconnect isn't silently dropped (NFR-R4).
  private outbox: string[] = [];
  // Order rooms joined, re-sent after a reconnect (the server forgets them).
  private rooms = new Set<string>();

  constructor(private url: string, private onStatus: (connected: boolean) => void) {
    this.connect();
  }

  private connect() {
    if (this.closed) return;
    const ws = new WebSocket(this.url);
    this.ws = ws;

    ws.onopen = () => {
      if (this.ws !== ws) return;
      this.retries = 0;
      this.onStatus(true);
      this.rooms.forEach((room) => ws.send(JSON.stringify({ event: 'join', room })));
      const pending = this.outbox;
      this.outbox = [];
      pending.forEach((frame) => ws.send(frame));
      this.startHeartbeat();
      this.fire('connect', null);
    };

    ws.onmessage = (e) => {
      if (this.ws !== ws) return;
      this.clearPongTimer(); // any frame proves the connection is alive
      try {
        const { event, data } = JSON.parse(e.data as string);
        if (event === 'pong') return;
        this.fire(event, data);
      } catch {
        // Ignore frames that aren't our JSON envelope.
      }
    };

    ws.onerror = () => {
      // A close always follows, which is where reconnection is handled.
    };

    ws.onclose = () => {
      if (this.ws !== ws) return; // an old socket we already replaced
      this.stopHeartbeat();
      this.onStatus(false);
      this.scheduleReconnect();
    };
  }

  private fire(event: string, data: unknown) {
    this.handlers.get(event)?.forEach((h) => {
      try { h(data); } catch { /* one bad listener must not stop the others */ }
    });
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.pingTimer = setInterval(() => this.ping(), PING_EVERY_MS);
  }

  private stopHeartbeat() {
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = null;
    this.clearPongTimer();
  }

  private clearPongTimer() {
    if (this.pongTimer) clearTimeout(this.pongTimer);
    this.pongTimer = null;
  }

  /** Sends a ping; if no frame arrives within PONG_TIMEOUT_MS the connection is replaced. */
  private ping() {
    const ws = this.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN || this.pongTimer) return;
    try {
      ws.send(JSON.stringify({ event: 'ping' }));
    } catch {
      this.restart();
      return;
    }
    this.pongTimer = setTimeout(() => this.restart(), PONG_TIMEOUT_MS);
  }

  /** Drops the current connection (dead or not) and connects again immediately. */
  private restart() {
    if (this.closed) return;
    const old = this.ws;
    this.ws = null;
    this.stopHeartbeat();
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.onStatus(false);
    try { old?.close(); } catch { /* already gone */ }
    this.retries = 0;
    this.connect();
  }

  /**
   * The app came back to the foreground: reconnect now if the socket is down,
   * otherwise ping straight away so a connection that died in the background
   * is noticed in seconds rather than at the next 25s tick.
   */
  wake() {
    if (this.closed) return;
    const state = this.ws?.readyState;
    if (state === WebSocket.OPEN) {
      this.ping();
    } else if (state !== WebSocket.CONNECTING) {
      this.restart();
    }
  }

  private scheduleReconnect() {
    if (this.closed) return;
    // Exponential backoff capped at 10s, so a sleeping server doesn't get hammered.
    const delay = Math.min(1000 * 2 ** this.retries++, 10000);
    if (this.timer) clearTimeout(this.timer);
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
    const room = `order:${orderId}`;
    this.rooms.add(room);
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ event: 'join', room }));
    // While down, the join is re-sent from `rooms` on open.
  }

  leaveOrder(orderId: string) {
    const room = `order:${orderId}`;
    this.rooms.delete(room);
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ event: 'leave', room }));
  }

  close() {
    this.closed = true;
    this.stopHeartbeat();
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
    // Back in the foreground: check the connection right away (iOS pauses it in the background).
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') next.wake();
    });

    return () => {
      sub.remove();
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
