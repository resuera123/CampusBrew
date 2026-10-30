import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { AuthService, AuthResponse } from '../services/AuthService';

interface AuthContextType {
  user: AuthResponse | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<AuthResponse>) => Promise<void>;
  /** Replace the session, e.g. after switching between customer and dasher. */
  setSession: (response: AuthResponse) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AuthResponse | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  // A suspended account gets 403 {suspended: true} from every API call; sign it
  // out once instead of leaving each screen to show the error.
  const signingOut = useRef(false);
  useEffect(() => {
    const originalFetch = global.fetch;
    global.fetch = async (...args: Parameters<typeof fetch>) => {
      const res = await originalFetch(...args);
      if (res.status === 403 && !signingOut.current) {
        try {
          const body = await res.clone().json();
          if (body?.suspended) {
            signingOut.current = true;
            await clearSession();
            Alert.alert('Account suspended', body.error ?? 'Your account is suspended.');
            signingOut.current = false;
          }
        } catch {
          // Not JSON — leave it to the caller.
        }
      }
      return res;
    };
    return () => {
      global.fetch = originalFetch;
    };
  }, []);

  const loadStoredAuth = async () => {
    try {
      const storedToken = await SecureStore.getItemAsync('auth_token');
      const storedUser = await SecureStore.getItemAsync('auth_user');
      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      }
    } catch (error) {
      console.error('Failed to load auth:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const setSession = async (response: AuthResponse) => {
    await SecureStore.setItemAsync('auth_token', response.token);
    await SecureStore.setItemAsync('auth_user', JSON.stringify(response));
    setToken(response.token);
    setUser(response);
  };

  const login = async (email: string, password: string) => {
    await setSession(await AuthService.login({ email, password }));
  };

  const clearSession = async () => {
    await SecureStore.deleteItemAsync('auth_token');
    await SecureStore.deleteItemAsync('auth_user');
    setToken(null);
    setUser(null);
  };

  const logout = clearSession;

  /**
   * Update user state in memory + SecureStore without requiring re-login.
   * Used after account verification to immediately reflect VERIFIED status.
   */
  const updateUser = async (updates: Partial<AuthResponse>) => {
    if (!user) return;
    const updatedUser = { ...user, ...updates };
    setUser(updatedUser);
    await SecureStore.setItemAsync('auth_user', JSON.stringify(updatedUser));
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, updateUser, setSession }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};