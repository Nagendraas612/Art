"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { signUp } from "@/lib/auth-client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SocialAuthButtons } from "@/components/ui/SocialAuthButtons";
import styles from "../auth.module.css";

export default function SignUpPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Preserve the page the user originally tried to reach, through the
  // email-verification loop (same-origin only).
  const callbackUrl = (() => {
    const requested = searchParams.get("callbackUrl");
    if (requested && requested.startsWith("/") && !requested.startsWith("//")) {
      return requested;
    }
    return "/explore";
  })();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);

    try {
      const result = await signUp.email({
        name,
        email,
        password,
        // After the user clicks the verification link, better-auth signs
        // them in (autoSignInAfterVerification) and lands them here —
        // the toast confirms the loop is closed. The original destination
        // is preserved through the verification loop.
        callbackURL: `${callbackUrl}${callbackUrl.includes("?") ? "&" : "?"}toast=email-verified`,
      });

      if (result.error) {
        setError(result.error.message || "Sign up failed. Please try again.");
      } else {
        // Email verification is enforced: the account exists now, but the
        // user has no session until they click the verification link.
        // Redirect and announce it with a toast so the silent
        // redirect doesn't look like a glitch.
        router.push("/explore?toast=signup-verify");
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
          <h1 className={styles.title}>Create your account</h1>
          <p className={styles.subtitle}>
            Join a community of independent artists and collectors.
          </p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <div className={styles.alert}>{error}</div>}

          <Input
            label="Full name"
            type="text"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
          />

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
            placeholder="Minimum 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />

          <Button type="submit" variant="primary" fullWidth disabled={loading}>
            {loading ? "Creating account…" : "Create account"}
          </Button>
        </form>

        <div className={styles.divider}>
          <span>or</span>
        </div>

        <SocialAuthButtons callbackUrl={callbackUrl} onError={(msg) => setError(msg)} />

        <p className={styles.termsNotice}>
          By registering, you agree to Kalaa Bhadra&apos;s{" "}
          <Link href="/terms">Terms of Use</Link> and{" "}
          <Link href="/privacy">Privacy Policy</Link>.
        </p>

        <p className={styles.footer}>
          Already have an account?{" "}
          <Link href="/sign-in" className={styles.link}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
