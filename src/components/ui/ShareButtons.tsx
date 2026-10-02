"use client";

import React, { useState } from "react";
import styles from "./ShareButtons.module.css";

interface ShareButtonsProps {
  title: string;
  url?: string;
}

export function ShareButtons({ title, url }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);

  const shareUrl = url || (typeof window !== "undefined" ? window.location.href : "");
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedTitle = encodeURIComponent(`Check out "${title}" on Kalaa Bhadra:`);

  const handleCopy = async () => {
    try {
      if (typeof window !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (err) {
      console.error("Failed to copy link", err);
    }
  };

  return (
    <div className={styles.container}>
      <span className={styles.label}>Share Piece:</span>
      <div className={styles.buttons}>
        <button onClick={handleCopy} className={styles.btn} title="Copy Link">
          {copied ? "✓ Copied" : "🔗 Copy Link"}
        </button>
        <a
          href={`https://api.whatsapp.com/send?text=${encodedTitle}%20${encodedUrl}`}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.btn}
          title="Share on WhatsApp"
        >
          💬 WhatsApp
        </a>
        <a
          href={`https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.btn}
          title="Share on X"
        >
          𝕏 Post
        </a>
      </div>
    </div>
  );
}
