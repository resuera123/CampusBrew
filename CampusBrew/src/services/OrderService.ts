import { API_BASE_URL } from '../constants/api';

export type PaymentMethod = 'GCASH' | 'COD';
export type PaymentStatus =
  | 'PENDING'
  | 'PAID_GCASH'
  | 'PENDING_COD'
  | 'PAID_COD'
  | 'REFUND_PENDING'
  | 'REFUNDED'
  | 'FLAGGED'; // v2.0 FR-4.2
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

export interface StatusHistoryEntry {
  status: OrderStatus;
  timestamp: string;
}

export interface CreateOrderItem {
  menuItemId: string;
  quantity: number;
  size?: string;
  sugarLevel?: string;
  temperature?: string;
  addOns?: string[];
  optionsHash?: string; // v2.0 FR-2.2
}

export interface CreateOrderRequest {
  shopId: string;
  items: CreateOrderItem[];
  deliveryLocation: string;
  dasherInstructions?: string;
  paymentMethod: PaymentMethod;
  tip?: number; // v2.0 FR-4.7
  dropoffNote?: string; // v2.0 FR-3.4
}

export interface Order {
  id: string;
  customerId: string;
  customerName?: string;
  shopId: string;
  shopName?: string;
  deliveryPersonnelId?: string;
  deliveryPersonnelName?: string;
  items: OrderItem[];
  deliveryLocation: string;
  dasherInstructions?: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  beverageSubtotal: number;
  deliveryFee: number;
  platformCommission: number;
  totalAmount: number;
  paymentUrl?: string;
  // v2.0 FR-4.1 — when true there is no order yet (id is null): open paymentUrl,
  // then poll PaymentService.getPayment(paymentId) until the status leaves PENDING.
  paymentRequired?: boolean;
  paymentId?: string;
  tip?: number; // v2.0 FR-4.7
  dropoffNote?: string; // v2.0 FR-3.4
  // v2.0 FR-4.2 — COD two-sided settlement amounts
  cashCollectedAmount?: number | null;
  customerConfirmedAmount?: number | null;
  shopPaymentConfirmedAt?: string | null; // v2.0 FR-3.3
  statusHistory?: StatusHistoryEntry[];
  readyAt?: string;
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

  async getOrderById(orderId: string, token: string): Promise<Order> {
    const res = await fetch(`${API_BASE_URL}/api/orders/${orderId}`, {
      headers: authHeaders(token),
    });
    const json = await safeJson(res);
    if (!res.ok) throw new Error(json.error || 'Failed to load order');
    return json;
  },

  // v2.0 FR-4.2 — customer confirms the cash amount they paid (COD settlement).
  async confirmPayment(orderId: string, amount: number, token: string): Promise<Order> {
    const res = await fetch(`${API_BASE_URL}/api/orders/${orderId}/confirm-payment`, {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify({ amount }),
    });
    const json = await safeJson(res);
    if (!res.ok) throw new Error(json.error || 'Failed to confirm payment');
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
