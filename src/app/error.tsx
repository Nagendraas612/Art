"use client";

import { useEffect } from "react";
import Link from "next/link";
import styles from "./error.module.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled Application Error:", error);
  }, [error]);

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <span className={styles.badge}>Notice</span>
        <h1 className={styles.title}>An Unexpected Interruption</h1>
        <p className={styles.description}>
          We encountered a slight disturbance while rendering this view. Our team has been notified.
        </p>

        {error.digest && (
          <p className={styles.digest}>
            Reference ID: <code>{error.digest}</code>
          </p>
        )}

        <div className={styles.actions}>
          <button onClick={reset} className={styles.primaryBtn}>
            Try Again
          </button>
          <Link href="/" className={styles.secondaryBtn}>
            Return to Gallery
          </Link>
        </div>
      </div>
    </div>
  );
}
