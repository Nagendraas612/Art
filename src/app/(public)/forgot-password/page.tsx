"use client";

import { useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import styles from "../auth.module.css";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await (authClient as any).forgetPassword({
        email,
        redirectTo: "/reset-password",
      });

      if (res.error) {
        setError(res.error.message || "Failed to send reset email. Please check the address.");
      } else {
        setSubmitted(true);
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.header}>
          <Link href="/" className={styles.mark}>
            Atelier &amp; Co.
          </Link>
          <h1 className={styles.title}>Reset Password</h1>
          <p className={styles.subtitle}>
            Enter your email address and we will send you instructions to reset your password.
          </p>
        </div>

        {submitted ? (
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
              If an account is associated with <strong>{email}</strong>, a password reset link has been dispatched to your email inbox.
            </div>
            <Link
              href="/sign-in"
              className={styles.link}
              style={{ fontFamily: "var(--sans)", fontSize: "0.9rem", fontWeight: 500 }}
            >
              &larr; Back to Sign In
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className={styles.form}>
            {error && <div className={styles.alert}>{error}</div>}

            <Input
              label="Email address"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />

            <Button type="submit" variant="primary" fullWidth disabled={loading}>
              {loading ? "Sending link…" : "Send Reset Link"}
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
    </div>
  );
}
