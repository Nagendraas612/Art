"use client";

import { useState, useTransition } from "react";
import { toggleWishlistAction } from "@/app/actions/wishlist";
import styles from "./WishlistButton.module.css";

interface WishlistButtonProps {
  artworkId: string;
  initialWishlisted?: boolean;
  size?: "sm" | "md";
  className?: string;
}

export function WishlistButton({
  artworkId,
  initialWishlisted = false,
  size = "sm",
  className = "",
}: WishlistButtonProps) {
  const [wishlisted, setWishlisted] = useState(initialWishlisted);
  const [animating, setAnimating] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setAnimating(true);
    setTimeout(() => setAnimating(false), 400);

    // Optimistic update
    setWishlisted((prev) => !prev);

    startTransition(async () => {
      const result = await toggleWishlistAction(artworkId);
      if ("error" in result) {
        // Revert on error
        setWishlisted((prev) => !prev);
      } else {
        setWishlisted(result.wishlisted);
      }
    });
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={isPending}
      className={`${styles.btn} ${wishlisted ? styles.active : ""} ${animating ? styles.animating : ""} ${styles[size]} ${className}`}
      aria-label={wishlisted ? "Remove from saved collection" : "Save to collection"}
      title={wishlisted ? "Saved to Collection" : "Save to Collection"}
    >
      <svg
        viewBox="0 0 24 24"
        className={styles.icon}
        fill={wishlisted ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    </button>
  );
}
