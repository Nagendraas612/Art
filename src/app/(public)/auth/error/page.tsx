"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import styles from "@/app/(public)/auth.module.css";

const messages: Record<string, { title: string; body: string }> = {
  account_not_linked: {
    title: "This email is already registered",
    body: "You signed up with email and password. Please sign in that way first, then link Google from your account settings.",
  },
  oauth_not_linked: {
    title: "Couldn't connect that account",
    body: "This social account isn't linked to your Kalaa Bhadra profile. Sign in with your original method first.",
  },
  default: {
    title: "Something went wrong",
    body: "We couldn't complete that sign-in. Please try again — if it keeps happening, contact support.",
  },
};

function ErrorContent() {
  const searchParams = useSearchParams();
  const code = searchParams.get("error") || "default";
  const { title, body } = messages[code] || messages.default;

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.header}>
          <Link href="/" className={styles.mark}>
            Kalaa Bhadra
          </Link>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.subtitle}>{body}</p>
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
          <Link href="/sign-in" className={styles.socialBtnGoogle} style={{ textDecoration: "none", justifyContent: "center" }}>
            Back to sign in
          </Link>
          <Link href="/" style={{ alignSelf: "center", fontSize: 14 }}>
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={null}>
      <ErrorContent />
    </Suspense>
  );
}
