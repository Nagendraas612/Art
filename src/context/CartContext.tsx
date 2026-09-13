"use client";

import React, { createContext, useContext, useEffect, useState, useTransition } from "react";

export interface CartItemData {
  id: string;
  title: string;
  slug: string;
  price: number;
  currency: string;
  imageUrl: string;
  productType: string;
  creatorName: string;
  creatorStore: string;
  creatorHandle: string;
  stock: number;
  quantity: number;
}

interface CartContextType {
  items: CartItemData[];
  addItem: (item: Omit<CartItemData, "quantity">, quantity?: number) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  itemCount: number;
  subtotal: number;
  formattedSubtotal: string;
  isHydrated: boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = "atelier_cart_v1";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItemData[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const [, startTransition] = useTransition();

  // Load initial cart from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(CART_STORAGE_KEY);
      if (stored) {
        setItems(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to load cart from localStorage", e);
    } finally {
      setIsHydrated(true);
    }
  }, []);

  // Sync to localStorage
  useEffect(() => {
    if (!isHydrated) return;
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.error("Failed to save cart to localStorage", e);
    }
  }, [items, isHydrated]);

  const addItem = (item: Omit<CartItemData, "quantity">, quantity = 1) => {
    startTransition(() => {
      setItems((prev) => {
        const existingIdx = prev.findIndex((i) => i.id === item.id);
        if (existingIdx > -1) {
          const updated = [...prev];
          // For ORIGINAL 1/1, max quantity is 1
          const isOriginal = item.productType === "ORIGINAL";
          const maxStock = isOriginal ? 1 : item.stock || 10;
          const newQty = Math.min(updated[existingIdx].quantity + quantity, maxStock);
          updated[existingIdx] = { ...updated[existingIdx], quantity: newQty };
          return updated;
        } else {
          return [...prev, { ...item, quantity: Math.min(quantity, item.stock || 10) }];
        }
      });
    });
  };

  const removeItem = (id: string) => {
    startTransition(() => {
      setItems((prev) => prev.filter((i) => i.id !== id));
    });
  };

  const updateQuantity = (id: string, quantity: number) => {
    startTransition(() => {
      setItems((prev) => {
        if (quantity <= 0) {
          return prev.filter((i) => i.id !== id);
        }
        return prev.map((i) => {
          if (i.id === id) {
            const isOriginal = i.productType === "ORIGINAL";
            const maxStock = isOriginal ? 1 : i.stock || 10;
            return { ...i, quantity: Math.min(quantity, maxStock) };
          }
          return i;
        });
      });
    });
  };

  const clearCart = () => {
    startTransition(() => {
      setItems([]);
      try {
        localStorage.removeItem(CART_STORAGE_KEY);
      } catch (e) {
        // ignore
      }
    });
  };

  const itemCount = items.reduce((acc, curr) => acc + curr.quantity, 0);
  const subtotal = items.reduce((acc, curr) => acc + curr.price * curr.quantity, 0);

  const formattedSubtotal = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(subtotal);

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        itemCount,
        subtotal,
        formattedSubtotal,
        isHydrated,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
