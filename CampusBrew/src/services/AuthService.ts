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

// Safe JSON parser — handles empty or non-JSON responses
async function safeJson(res: Response): Promise<any> {
  const text = await res.text();
  if (!text) throw new Error('Server returned an empty response');
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Server error: unexpected response');
  }
}

export const AuthService = {
  // ─── 1.1 Registration ───
  async register(data: RegisterRequest): Promise<{ message: string }> {
    const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await safeJson(res);
    if (!res.ok) throw new Error(json.error || 'Registration failed');
    return json;
  },

  async verifyOtp(email: string, otp: string): Promise<{ message: string }> {
    const res = await fetch(`${API_BASE_URL}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp }),
    });
    const json = await safeJson(res);
    if (!res.ok) throw new Error(json.error || 'OTP verification failed');
    return json;
  },

  async resendOtp(email: string): Promise<{ message: string }> {
    const res = await fetch(`${API_BASE_URL}/api/auth/resend-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const json = await safeJson(res);
    if (!res.ok) throw new Error(json.error || 'Failed to resend OTP');
    return json;
  },

  // ─── 1.2 Login ───
  async login(data: LoginRequest): Promise<AuthResponse> {
    const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await safeJson(res);
    if (!res.ok) throw new Error(json.error || 'Login failed');
    return json;
  },

  // ─── 1.3 Forgot / Reset Password ───
  async forgotPassword(email: string): Promise<{ message: string }> {
    const res = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const json = await safeJson(res);
    if (!res.ok) throw new Error(json.error || 'Failed to send reset code');
    return json;
  },

  async resetPassword(email: string, code: string, newPassword: string): Promise<{ message: string }> {
    const res = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code, newPassword }),
    });
    const json = await safeJson(res);
    if (!res.ok) throw new Error(json.error || 'Password reset failed');
    return json;
  },

  // ─── 1.4 Account Verification ───
  async sendVerificationOtp(schoolEmail: string, token: string): Promise<{ message: string }> {
    const res = await fetch(`${API_BASE_URL}/api/verification/send-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ schoolEmail }),
    });
    const json = await safeJson(res);
    if (!res.ok) throw new Error(json.error || 'Failed to send verification OTP');
    return json;
  },

  async verifyAccount(schoolEmail: string, otp: string, studentId: string, token: string): Promise<{ message: string }> {
    const res = await fetch(`${API_BASE_URL}/api/verification/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ schoolEmail, otp, studentId }),
    });
    const json = await safeJson(res);
    if (!res.ok) throw new Error(json.error || 'Verification failed');
    return json;
  },
};