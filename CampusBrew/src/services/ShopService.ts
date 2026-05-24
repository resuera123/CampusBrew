import { API_BASE_URL } from '../constants/api';

export interface OperatingHours {
  openTime: string;
  closeTime: string;
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
  available: boolean; // backend field "isAvailable" serialises to "available"
  isAvailable?: boolean;
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

function menuItemAvailable(item: MenuItem): boolean {
  return item.isAvailable ?? item.available ?? true;
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
    return (json as MenuItem[]).map((item) => ({
      ...item,
      isAvailable: menuItemAvailable(item),
    }));
  },

  async searchItems(query: string): Promise<MenuItem[]> {
    const res = await fetch(
      `${API_BASE_URL}/api/shops/search?q=${encodeURIComponent(query)}`,
    );
    const json = await safeJson(res);
    if (!res.ok) throw new Error(json.error || 'Search failed');
    return json;
  },
};
