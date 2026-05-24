import { API_BASE_URL } from '../constants/api';

export type PaymentMethod = 'GCASH' | 'COD';
export type PaymentStatus =
  | 'PENDING'
  | 'PAID_GCASH'
  | 'PENDING_COD'
  | 'PAID_COD'
  | 'REFUNDED';
export type OrderStatus =
  | 'PLACED'
  | 'PREPARING'
  | 'READY_FOR_PICKUP'
  | 'ASSIGNED'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED';

export interface OrderItem {
  menuItemId: string;
  itemName: string;
  quantity: number;
  size?: string;
  sugarLevel?: string;
  temperature?: string;
  addOns?: string[];
  unitPrice: number;
  totalPrice: number;
}

export interface CreateOrderItem {
  menuItemId: string;
  quantity: number;
  size?: string;
  sugarLevel?: string;
  temperature?: string;
  addOns?: string[];
}

export interface CreateOrderRequest {
  shopId: string;
  items: CreateOrderItem[];
  deliveryLocation: string;
  paymentMethod: PaymentMethod;
}

export interface Order {
  id: string;
  customerId: string;
  shopId: string;
  shopName?: string;
  deliveryPersonnelId?: string;
  items: OrderItem[];
  deliveryLocation: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  beverageSubtotal: number;
  deliveryFee: number;
  platformCommission: number;
  totalAmount: number;
  paymentUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrderHistoryPage {
  content: Order[];
  totalPages: number;
  totalElements: number;
  number: number;
  size: number;
  first: boolean;
  last: boolean;
}

export interface ReorderItem {
  menuItemId: string;
  itemName: string;
  image?: string;
  quantity: number;
  size?: string;
  sugarLevel?: string;
  temperature?: string;
  addOns?: string[];
  currentUnitPrice: number;
  currentTotalPrice: number;
  isAvailable: boolean;
}

export interface PriceChangeNote {
  itemName: string;
  previousPrice: number;
  currentPrice: number;
}

export interface ReorderPayload {
  shopId: string;
  shopName: string;
  items: ReorderItem[];
  unavailableItems: string[];
  priceChanges: PriceChangeNote[];
}

async function safeJson(res: Response): Promise<any> {
  const text = await res.text();
  if (!text) throw new Error('Server returned an empty response');
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Server error: unexpected response');
  }
}

function authHeaders(token: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export const OrderService = {
  async createOrder(req: CreateOrderRequest, token: string): Promise<Order> {
    const res = await fetch(`${API_BASE_URL}/api/orders`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(req),
    });
    const json = await safeJson(res);
    if (!res.ok) throw new Error(json.error || 'Failed to place order');
    return json;
  },

  async getHistory(token: string, page: number = 0): Promise<OrderHistoryPage> {
    const res = await fetch(
      `${API_BASE_URL}/api/orders/history?page=${page}`,
      { headers: authHeaders(token) },
    );
    const json = await safeJson(res);
    if (!res.ok) throw new Error(json.error || 'Failed to load order history');
    return json;
  },

  async reorder(orderId: string, token: string): Promise<ReorderPayload> {
    const res = await fetch(
      `${API_BASE_URL}/api/orders/reorder/${orderId}`,
      { method: 'POST', headers: authHeaders(token) },
    );
    const json = await safeJson(res);
    if (!res.ok) throw new Error(json.error || 'Failed to prepare reorder');
    return json;
  },
};
