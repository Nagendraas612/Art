"use client";

import { useState, useTransition } from "react";
import { toggleFollowAction } from "@/app/actions/follows";
import styles from "./FollowButton.module.css";

interface FollowButtonProps {
  creatorId: string;
  initialFollowing?: boolean;
  initialCount?: number;
  compact?: boolean;
  className?: string;
}

export function FollowButton({
  creatorId,
  initialFollowing = false,
  initialCount = 0,
  compact = false,
  className = "",
}: FollowButtonProps) {
  const [following, setFollowing] = useState(initialFollowing);
  const [count, setCount] = useState(initialCount);
  const [isPending, startTransition] = useTransition();

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Optimistic update
    setFollowing((prev) => !prev);
    setCount((prev) => (following ? prev - 1 : prev + 1));

    startTransition(async () => {
      const result = await toggleFollowAction(creatorId);
      if ("error" in result) {
        setFollowing((prev) => !prev);
        setCount((prev) => (following ? prev + 1 : prev - 1));
      } else {
        setFollowing(result.following);
      }
    });
  };

  if (compact) {
    return (
      <button
        type="button"
        onClick={handleToggle}
        disabled={isPending}
        className={`${styles.compactBtn} ${following ? styles.compactFollowing : ""} ${className}`}
      >
        {following ? "Following" : "Follow"}
      </button>
    );
  }

  return (
    <div className={`${styles.wrap} ${className}`}>
      <button
        type="button"
        onClick={handleToggle}
        disabled={isPending}
        className={`${styles.btn} ${following ? styles.following : ""}`}
      >
        {following ? (
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span className={styles.label}>Following</span>
          </>
        ) : (
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span className={styles.label}>Follow</span>
          </>
        )}
      </button>
      {count > 0 && (
        <span className={styles.count}>
          {count.toLocaleString()} {count === 1 ? "follower" : "followers"}
        </span>
      )}
    </div>
  );
}
