import { API_BASE_URL } from '../constants/api';

export interface OperatingHours {
  openTime: string;
  closeTime: string;
}

export interface CreateMenuItemRequest {
  shopId: string;
  name: string;
  price: number;
  description?: string;
  category: string;
  image?: string;
  isAvailable?: boolean;
  stockStatus?: string;
  customizationOptions?: CustomizationOptions;
}

export interface UpdateMenuItemRequest {
  name?: string;
  price?: number;
  description?: string;
  category?: string;
  image?: string;
  isAvailable?: boolean;
  stockStatus?: string;
  customizationOptions?: CustomizationOptions;
}

export interface UpdateShopRequest {
  shopName?: string;
  description?: string;
  operatingHours?: OperatingHours;
  location?: string;
  shopImage?: string;
  estimatedPrepTime?: string;
  isOpen?: boolean;
}

export interface Shop {
  id: string;
  shopName: string;
  description: string;
  operatingHours?: OperatingHours;
  location: string;
  shopImage?: string;
  rating: number;
  isOpen: boolean;
  estimatedPrepTime?: string;
}

export interface SizeOption {
  label: string;
  priceModifier: number;
}

export interface AddOnOption {
  name: string;
  price: number;
}

export interface CustomizationOptions {
  sizes?: SizeOption[];
  sugarLevels?: string[];
  temperatures?: string[];
  addOns?: AddOnOption[];
}

export interface MenuItem {
  id: string;
  shopId: string;
  name: string;
  price: number;
  description: string;
  category: string;
  image?: string;
  isAvailable: boolean;
  stockStatus?: string;
  customizationOptions?: CustomizationOptions;
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

export const ShopService = {
  async getShops(openOnly: boolean = false): Promise<Shop[]> {
    const res = await fetch(`${API_BASE_URL}/api/shops?openOnly=${openOnly}`);
    const json = await safeJson(res);
    if (!res.ok) throw new Error(json.error || 'Failed to load shops');
    return json;
  },

  async getShop(shopId: string): Promise<Shop> {
    const res = await fetch(`${API_BASE_URL}/api/shops/${shopId}`);
    const json = await safeJson(res);
    if (!res.ok) throw new Error(json.error || 'Failed to load shop');
    return json;
  },

  async getMenu(shopId: string): Promise<MenuItem[]> {
    const res = await fetch(`${API_BASE_URL}/api/shops/${shopId}/menu`);
    const json = await safeJson(res);
    if (!res.ok) throw new Error(json.error || 'Failed to load menu');
    return json as MenuItem[];
  },

  async searchItems(query: string): Promise<MenuItem[]> {
    const res = await fetch(
      `${API_BASE_URL}/api/shops/search?q=${encodeURIComponent(query)}`,
    );
    const json = await safeJson(res);
    if (!res.ok) throw new Error(json.error || 'Search failed');
    return json;
  },

  // ─── Shop Operator: own shop ───
  async getMyShop(token: string): Promise<Shop> {
    const res = await fetch(`${API_BASE_URL}/api/shops/me`, {
      headers: authHeaders(token),
    });
    const json = await safeJson(res);
    if (!res.ok) throw new Error(json.error || 'Failed to load shop');
    return json;
  },

  async updateShop(shopId: string, req: UpdateShopRequest, token: string): Promise<Shop> {
    const res = await fetch(`${API_BASE_URL}/api/shops/${shopId}`, {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify(req),
    });
    const json = await safeJson(res);
    if (!res.ok) throw new Error(json.error || 'Failed to update shop');
    return json;
  },

  // ─── Shop Operator: menu CRUD ───
  async createMenuItem(req: CreateMenuItemRequest, token: string): Promise<MenuItem> {
    const res = await fetch(`${API_BASE_URL}/api/menus`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(req),
    });
    const json = await safeJson(res);
    if (!res.ok) throw new Error(json.error || 'Failed to create menu item');
    return json as MenuItem;
  },

  async updateMenuItem(itemId: string, req: UpdateMenuItemRequest, token: string): Promise<MenuItem> {
    const res = await fetch(`${API_BASE_URL}/api/menus/${itemId}`, {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify(req),
    });
    const json = await safeJson(res);
    if (!res.ok) throw new Error(json.error || 'Failed to update menu item');
    return json as MenuItem;
  },

  async deleteMenuItem(itemId: string, token: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/menus/${itemId}`, {
      method: 'DELETE',
      headers: authHeaders(token),
    });
    if (!res.ok) {
      const json = await safeJson(res);
      throw new Error(json.error || 'Failed to delete menu item');
    }
  },

  async setAvailability(itemId: string, isAvailable: boolean, token: string): Promise<MenuItem> {
    const res = await fetch(`${API_BASE_URL}/api/menus/${itemId}/availability`, {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify({ isAvailable }),
    });
    const json = await safeJson(res);
    if (!res.ok) throw new Error(json.error || 'Failed to update availability');
    return json as MenuItem;
  },
};
