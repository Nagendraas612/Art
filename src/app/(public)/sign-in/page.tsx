"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "@/lib/auth-client";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SocialAuthButtons } from "@/components/ui/SocialAuthButtons";
import styles from "../auth.module.css";

// Cooldown between resend clicks (client-side). The API route enforces a
// stricter server-side limit (3 / 15 min / email+IP).
const RESEND_COOLDOWN_S = 60;

export default function SignInPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  async function handleResend() {
    if (resendLoading || cooldown > 0) return;
    setResendLoading(true);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not resend the email. Please try again.");
        return;
      }
      setCooldown(RESEND_COOLDOWN_S);
      toast("Verification email sent — check your inbox (and spam folder).", "success");
    } catch {
      setError("Could not resend the email. Please try again.");
    } finally {
      setResendLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNeedsVerification(false);
    setLoading(true);

    try {
      const result = await signIn.email({
        email,
        password,
      });

      if (result.error) {
        const code = (result.error as { code?: string }).code || "";
        const msg = result.error.message || "";
        if (
          code === "EMAIL_NOT_VERIFIED" ||
          /not verified/i.test(code) ||
          /not verified/i.test(msg) ||
          /verify your email/i.test(msg)
        ) {
          setNeedsVerification(true);
          setError(
            "Please verify your email before signing in. Check your inbox for the verification link."
          );
        } else {
          setError(msg || "Sign in failed. Please try again.");
        }
      } else {
        router.push("/explore?toast=welcome-back");
        router.refresh();
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.header}>
          <Link href="/" className={styles.mark}>
            Kalaa Bhadra
          </Link>
          <h1 className={styles.title}>Welcome back</h1>
          <p className={styles.subtitle}>
            Sign in to continue to your account.
          </p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <div className={styles.alert}>{error}</div>}

          {needsVerification && (
            <div className={styles.alert} style={{ marginTop: "-4px" }}>
              <p style={{ margin: "0 0 10px" }}>
                Didn&apos;t get the email? We can send it again.
              </p>
              <Button
                type="button"
                variant="secondary"
                fullWidth
                disabled={resendLoading || cooldown > 0}
                onClick={handleResend}
              >
                {resendLoading
                  ? "Sending…"
                  : cooldown > 0
                    ? `Resend available in ${cooldown}s`
                    : "Resend verification email"}
              </Button>
            </div>
          )}

          <Input
            label="Email address"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />

          <Input
            label="Password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />

          <div className={styles.checkboxRow} style={{ justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input type="checkbox" id="staySignedIn" defaultChecked />
              <label htmlFor="staySignedIn">Stay signed in</label>
            </div>
            <Link href="/forgot-password" className={styles.link} style={{ fontSize: "0.85rem" }}>
              Forgot password?
            </Link>
          </div>

          <Button type="submit" variant="primary" fullWidth disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <div className={styles.divider}>
          <span>or</span>
        </div>

        <SocialAuthButtons onError={(msg) => setError(msg)} />

        <p className={styles.termsNotice}>
          By continuing, you agree to Kalaa Bhadra&apos;s{" "}
          <Link href="/terms">Terms of Use</Link> and{" "}
          <Link href="/privacy">Privacy Policy</Link>.
        </p>

        <p className={styles.footer}>
          Don&apos;t have an account?{" "}
          <Link href="/sign-up" className={styles.link}>
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
