"use client";

import React from "react";
import Link from "next/link";
import { useCart } from "@/context/CartContext";
import styles from "./CartNavButton.module.css";

export function CartNavButton() {
  const { itemCount, isHydrated } = useCart();

  return (
    <Link href="/cart" className={styles.cartBtn} aria-label={`View Cart (${itemCount} items)`}>
      <svg
        className={styles.icon}
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
        <line x1="3" y1="6" x2="21" y2="6" />
        <path d="M16 10a4 4 0 0 1-8 0" />
      </svg>
      <span className={styles.label}>Bag</span>
      {isHydrated && itemCount > 0 && (
        <span className={styles.badge}>{itemCount}</span>
      )}
    </Link>
  );
}
