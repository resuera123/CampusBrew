const DEV_HOST = 'http://192.168.1.13'; // replace with your PC's IPv4
const PROD_BASE = 'https://your-render-url.onrender.com';

const API_PORT = 8080;
const SOCKET_PORT = 9092;

export const API_BASE_URL = __DEV__ ? `${DEV_HOST}:${API_PORT}` : PROD_BASE;
export const SOCKET_BASE_URL = __DEV__ ? `${DEV_HOST}:${SOCKET_PORT}` : PROD_BASE;
