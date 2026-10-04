"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import styles from "./Toast.module.css";

export type ToastType = "success" | "info" | "error";

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

const DISMISS_MS = 6000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, type: ToastType = "info") => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev.slice(-2), { id, message, type }]);
      window.setTimeout(() => dismiss(id), DISMISS_MS);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        className={styles.viewport}
        role="status"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((t) => (
          <div key={t.id} className={`${styles.toast} ${styles[t.type]}`}>
            <span className={styles.dot} aria-hidden="true" />
            <p className={styles.message}>{t.message}</p>
            <button
              type="button"
              className={styles.close}
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss notification"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// Messages shown after a redirect, driven by the `?toast=` query param.
// The param is removed from the URL right after the toast fires.
const QUERY_TOASTS: Record<string, { message: string; type: ToastType }> = {
  "signup-verify": {
    message:
      "Account created! We've sent a verification link — check your inbox (and spam folder) to sign in.",
    type: "success",
  },
  "welcome-back": {
    message: "Welcome back!",
    type: "success",
  },
  "verification-resent": {
    message: "Verification email sent — check your inbox (and spam folder).",
    type: "success",
  },
  "email-verified": {
    message: "Email verified — welcome to Kalaa Bhadra!",
    type: "success",
  },
};

export function ToastQueryReader() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const firedRef = useRef<string | null>(null);

  useEffect(() => {
    const key = searchParams.get("toast");
    if (!key || firedRef.current === key) return;
    const preset = QUERY_TOASTS[key];
    if (!preset) return;
    firedRef.current = key;
    toast(preset.message, preset.type);
    // Strip the param so refresh/back doesn't re-fire the toast.
    const next = new URLSearchParams(searchParams.toString());
    next.delete("toast");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [searchParams, pathname, router, toast]);

  return null;
}
