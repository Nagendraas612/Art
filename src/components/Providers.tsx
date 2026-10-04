"use client";

import React, { Suspense } from "react";
import { CartProvider } from "@/context/CartContext";
import { ToastProvider, ToastQueryReader } from "@/components/ui/Toast";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <ToastProvider>
        {children}
        <Suspense fallback={null}>
          <ToastQueryReader />
        </Suspense>
      </ToastProvider>
    </CartProvider>
  );
}
