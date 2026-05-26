import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { SOCKET_BASE_URL } from '../constants/api';
import { useAuth } from './AuthContext';

interface SocketContextType {
  socket: Socket | null;
  connected: boolean;
}

const SocketContext = createContext<SocketContextType>({ socket: null, connected: false });

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const { token } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!token) {
      setSocket(null);
      setConnected(false);
      return;
    }

    // JWT travels as URL query param so the backend AuthorizationListener can validate it.
    const next = io(SOCKET_BASE_URL, {
      query: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });

    next.on('connect', () => setConnected(true));
    next.on('disconnect', () => setConnected(false));
    next.on('connect_error', (err) => {
      console.warn('[socket] connect_error:', err.message);
    });

    setSocket(next);

    return () => {
      next.disconnect();
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
