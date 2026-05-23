import { API_BASE_URL } from '../constants/api';

export interface RegisterRequest {
  fullName: string;
  email: string;
  password: string;
  role: 'CUSTOMER' | 'DELIVERY_PERSONNEL' | 'SHOP_OPERATOR';
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  userId: string;
  fullName: string;
  role: string;
  verificationStatus: string;
}

export const AuthService = {
  async register(data: RegisterRequest): Promise<{ message: string }> {
    const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Registration failed');
    return json;
  },

  async verifyOtp(email: string, otp: string): Promise<{ message: string }> {
    const res = await fetch(`${API_BASE_URL}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'OTP verification failed');
    return json;
  },

  async login(data: LoginRequest): Promise<AuthResponse> {
    const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Login failed');
    return json;
  },

  async resendOtp(email: string): Promise<{ message: string }> {
    const res = await fetch(`${API_BASE_URL}/api/auth/resend-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to resend OTP');
    return json;
  },

  async ping(): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/ping`);
      return res.ok;
    } catch {
      return false;
    }
  },
};