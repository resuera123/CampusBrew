import React, { createContext, useContext, useState, useMemo } from 'react';
import { MenuItem } from '../services/ShopService';

export interface CartItem {
  cartItemId: string;
  menuItemId: string;
  shopId: string;
  shopName: string;
  itemName: string;
  image?: string;
  quantity: number;
  size?: string;
  sugarLevel?: string;
  temperature?: string;
  addOns: string[];
  unitPrice: number;
}

interface CartContextType {
  items: CartItem[];
  shopId: string | null;
  shopName: string | null;
  addItem: (item: Omit<CartItem, 'cartItemId'>) => void;
  removeItem: (cartItemId: string) => void;
  updateQuantity: (cartItemId: string, quantity: number) => void;
  replaceCart: (items: CartItem[], shopId: string, shopName: string) => void;
  clearCart: () => void;
  subtotal: number;
  itemCount: number;
}

const CartContext = createContext<CartContextType | null>(null);

let cartItemIdCounter = 0;
const newCartItemId = () => `ci-${Date.now()}-${++cartItemIdCounter}`;

export const CartProvider = ({ children }: { children: React.ReactNode }) => {
  const [items, setItems] = useState<CartItem[]>([]);
  const [shopId, setShopId] = useState<string | null>(null);
  const [shopName, setShopName] = useState<string | null>(null);

  const addItem = (item: Omit<CartItem, 'cartItemId'>) => {
    setItems((prev) => {
      // Cart is single-shop. Reset if a different shop is added.
      if (shopId && shopId !== item.shopId) {
        setShopId(item.shopId);
        setShopName(item.shopName);
        return [{ ...item, cartItemId: newCartItemId() }];
      }
      if (!shopId) {
        setShopId(item.shopId);
        setShopName(item.shopName);
      }
      return [...prev, { ...item, cartItemId: newCartItemId() }];
    });
  };

  const removeItem = (cartItemId: string) => {
    setItems((prev) => {
      const next = prev.filter((i) => i.cartItemId !== cartItemId);
      if (next.length === 0) {
        setShopId(null);
        setShopName(null);
      }
      return next;
    });
  };

  const updateQuantity = (cartItemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(cartItemId);
      return;
    }
    setItems((prev) =>
      prev.map((i) => (i.cartItemId === cartItemId ? { ...i, quantity } : i)),
    );
  };

  const replaceCart = (next: CartItem[], nextShopId: string, nextShopName: string) => {
    setItems(next);
    setShopId(nextShopId);
    setShopName(nextShopName);
  };

  const clearCart = () => {
    setItems([]);
    setShopId(null);
    setShopName(null);
  };

  const subtotal = useMemo(
    () => items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0),
    [items],
  );

  const itemCount = useMemo(
    () => items.reduce((sum, i) => sum + i.quantity, 0),
    [items],
  );

  return (
    <CartContext.Provider
      value={{
        items,
        shopId,
        shopName,
        addItem,
        removeItem,
        updateQuantity,
        replaceCart,
        clearCart,
        subtotal,
        itemCount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
};

// Helper: compute the unit price of a menu item given its customization
export function computeUnitPrice(
  item: MenuItem,
  size?: string,
  addOnNames: string[] = [],
): number {
  let price = item.price;
  const opts = item.customizationOptions;
  if (opts?.sizes && size) {
    const s = opts.sizes.find((o) => o.label.toLowerCase() === size.toLowerCase());
    if (s) price += s.priceModifier;
  }
  if (opts?.addOns && addOnNames.length) {
    for (const name of addOnNames) {
      const ao = opts.addOns.find((o) => o.name.toLowerCase() === name.toLowerCase());
      if (ao) price += ao.price;
    }
  }
  return Math.round(price * 100) / 100;
}
