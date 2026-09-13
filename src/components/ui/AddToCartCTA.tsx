"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/context/CartContext";
import { MessageArtistModal } from "@/components/ui/MessageArtistModal";
import { WishlistButton } from "@/components/ui/WishlistButton";
import styles from "./AddToCartCTA.module.css";

interface AddToCartCTAProps {
  artwork: {
    id: string;
    title: string;
    slug: string;
    price: number;
    currency: string;
    imageUrl: string;
    productType: string;
    stock: number;
    stockStatus: string;
    creatorId?: string;
    creatorName: string;
    creatorStore: string;
    creatorHandle: string;
  };
}

export function AddToCartCTA({ artwork }: AddToCartCTAProps) {
  const { addItem, items } = useCart();
  const router = useRouter();
  const [added, setAdded] = useState(false);

  const isSoldOut = artwork.stockStatus === "SOLD" || artwork.stock <= 0;
  const isOriginal = artwork.productType === "ORIGINAL";
  const existingInCart = items.find((i) => i.id === artwork.id);
  const isMaxReached = existingInCart && isOriginal && existingInCart.quantity >= 1;

  const formattedPrice = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: artwork.currency || "INR",
    maximumFractionDigits: 0,
  }).format(artwork.price);

  const handleAddToCart = () => {
    if (isSoldOut || isMaxReached) return;

    addItem({
      id: artwork.id,
      title: artwork.title,
      slug: artwork.slug,
      price: artwork.price,
      currency: artwork.currency || "INR",
      imageUrl: artwork.imageUrl,
      productType: artwork.productType,
      creatorName: artwork.creatorName,
      creatorStore: artwork.creatorStore,
      creatorHandle: artwork.creatorHandle,
      stock: artwork.stock,
    });

    setAdded(true);
    setTimeout(() => {
      setAdded(false);
    }, 3000);
  };

  const handleDirectAcquire = () => {
    handleAddToCart();
    router.push("/checkout");
  };

  if (isSoldOut) {
    return (
      <div className={styles.container}>
        <button type="button" disabled className={styles.soldOutButton}>
          Work Acquired &bull; Sold Out
        </button>
        {artwork.creatorId ? (
          <MessageArtistModal
            creatorId={artwork.creatorId}
            creatorName={artwork.creatorName}
            storeName={artwork.creatorStore}
            artworkTitle={artwork.title}
            triggerText={`Commission Similar Work with ${artwork.creatorName.split(" ")[0]}`}
            className={styles.inquireButton}
          />
        ) : (
          <Link href={`/creators/${artwork.creatorHandle}`} className={styles.inquireButton}>
            Commission Similar Work with {artwork.creatorName.split(" ")[0]}
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.buttonGroup}>
        <button
          type="button"
          onClick={handleDirectAcquire}
          className={styles.buyButton}
          aria-label="Acquire this artwork directly"
        >
          Acquire Work &bull; {formattedPrice}
        </button>

        <button
          type="button"
          onClick={handleAddToCart}
          disabled={isMaxReached}
          className={`${styles.cartButton} ${added ? styles.cartButtonSuccess : ""}`}
        >
          {added ? (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>Added to Bag</span>
            </>
          ) : isMaxReached ? (
            <span>Already in Bag</span>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
              <span>Add to Bag</span>
            </>
          )}
        </button>

        <WishlistButton artworkId={artwork.id} size="md" />
      </div>

      <div className={styles.auxLinks}>
        {artwork.creatorId ? (
          <MessageArtistModal
            creatorId={artwork.creatorId}
            creatorName={artwork.creatorName}
            storeName={artwork.creatorStore}
            artworkTitle={artwork.title}
            triggerText={`Inquire with ${artwork.creatorName.split(" ")[0]}`}
            className={styles.inquireButton}
          />
        ) : (
          <Link href={`/creators/${artwork.creatorHandle}`} className={styles.inquireButton}>
            Inquire with {artwork.creatorName.split(" ")[0]}
          </Link>
        )}
        {added && (
          <Link href="/cart" className={styles.viewCartLink}>
            View Bag &rarr;
          </Link>
        )}
      </div>
    </div>
  );
}
