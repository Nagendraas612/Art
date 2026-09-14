"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signUp } from "@/lib/auth-client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SocialAuthButtons } from "@/components/ui/SocialAuthButtons";
import styles from "../auth.module.css";

export default function SignUpPage() {
  const router = useRouter();
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
      });

      if (result.error) {
        setError(result.error.message || "Sign up failed. Please try again.");
      } else {
        router.push("/explore");
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
            Atelier &amp; Co.
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

        <SocialAuthButtons onError={(msg) => setError(msg)} />

        <p className={styles.termsNotice}>
          By registering, you agree to Atelier &amp; Co.&apos;s{" "}
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
