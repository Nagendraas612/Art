"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import styles from "../auth.module.css";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!token) {
      setError("Invalid or missing password reset token. Please request a new reset link.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const res = await (authClient as any).resetPassword({
        newPassword: password,
        token,
      });

      if (res?.error) {
        setError(res.error.message || "Failed to reset password. The link may have expired.");
      } else {
        setSuccess(true);
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <Link href="/" className={styles.mark}>
          Kalaa Bhadra
        </Link>
        <h1 className={styles.title}>Set New Password</h1>
        <p className={styles.subtitle}>
          Please enter your new password below.
        </p>
      </div>

      {!token ? (
        <div style={{ textAlign: "center", padding: "16px 0" }}>
          <div className={styles.alert} style={{ marginBottom: "20px" }}>
            Missing or invalid reset token. Please check the link from your email or request a new one.
          </div>
          <Link href="/forgot-password" className={styles.link} style={{ fontFamily: "var(--sans)", fontSize: "0.9rem" }}>
            Request New Reset Link
          </Link>
        </div>
      ) : success ? (
        <div style={{ textAlign: "center", padding: "16px 0" }}>
          <div
            style={{
              background: "var(--moss-tint)",
              color: "var(--moss)",
              padding: "16px",
              borderRadius: "var(--radius-sm)",
              fontFamily: "var(--sans)",
              fontSize: "0.9rem",
              marginBottom: "24px",
              lineHeight: "1.5",
            }}
          >
            Your password has been successfully updated!
          </div>
          <Button variant="primary" fullWidth onClick={() => router.push("/sign-in")}>
            Sign In with New Password
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <div className={styles.alert}>{error}</div>}

          <Input
            label="New Password"
            type="password"
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
          />

          <Input
            label="Confirm New Password"
            type="password"
            placeholder="Re-enter new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
          />

          <Button type="submit" variant="primary" fullWidth disabled={loading}>
            {loading ? "Updating Password…" : "Reset Password"}
          </Button>

          <p className={styles.footer} style={{ marginTop: "16px" }}>
            Remembered your password?{" "}
            <Link href="/sign-in" className={styles.link}>
              Sign in
            </Link>
          </p>
        </form>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className={styles.page}>
      <Suspense fallback={
        <div className={styles.card}>
          <div className={styles.header}>
            <div className={styles.mark}>Kalaa Bhadra</div>
            <h1 className={styles.title}>Loading…</h1>
          </div>
        </div>
      }>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
