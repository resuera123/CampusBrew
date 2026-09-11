import { NativeModules } from 'react-native';

// Pin a host here if auto-detection ever picks the wrong one, e.g. '192.168.1.7'.
// Leave empty to detect automatically.
const MANUAL_HOST = '';

const PROD_BASE = 'https://campusbrew-backend.onrender.com';

const API_PORT = 8080;

// Metro serves the JS bundle from the dev machine, so the bundle URL already
// holds that machine's current IP. Reading it here means the API host follows
// whatever network we're on (campus wifi, hotspot, ...) with no edits.
function detectDevHost(): string {
  if (MANUAL_HOST) return MANUAL_HOST;

  const scriptURL: string | undefined = NativeModules.SourceCode?.scriptURL;
  const host = scriptURL?.split('://')[1]?.split('/')[0]?.split(':')[0];

  return host || 'localhost';
}

const DEV_HOST = `http://${detectDevHost()}`;

export const API_BASE_URL = __DEV__ ? `${DEV_HOST}:${API_PORT}` : PROD_BASE;

// Realtime shares the API's port and host, so it works behind hosts that route
// public traffic to a single port. http -> ws, https -> wss.
export const SOCKET_URL = `${API_BASE_URL.replace(/^http/, 'ws')}/ws`;
