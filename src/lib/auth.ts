import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/prisma";

// Email verification can only be enforced when an email provider is actually
// configured — otherwise sign-in would lock every user out. The flag follows
// the provider: set RESEND_API_KEY (or Gmail SMTP) in production to enforce.
const emailProviderConfigured = !!(
  process.env.RESEND_API_KEY ||
  process.env.GMAIL_USER ||
  process.env.SMTP_USER
);

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  baseURL:
    process.env.BETTER_AUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null) ||
    "https://kalaabhadra.vercel.app",

  // OAuth / verification failures land on a branded recovery page, not a
  // raw JSON error.
  errorURL: "/auth/error",

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    // When an email provider is configured, users must verify their email
    // before they can sign in. Google OAuth users are inherently verified.
    requireEmailVerification: emailProviderConfigured,
    // A password reset means the old credential is compromised until proven
    // otherwise — kill every session so a stolen session can't survive it.
    revokeSessionsOnPasswordReset: true,
    async sendResetPassword({ user, url }) {
      const { sendEmail, generatePasswordResetEmail } = await import("@/lib/email");
      const result = await sendEmail({
        to: user.email,
        subject: "Reset your Kalaa Bhadra password",
        html: generatePasswordResetEmail({
          userName: user.name || "Artisan Collector",
          resetUrl: url,
        }),
      });
      // Never swallow send failures: a silent "success" here is how users
      // end up staring at an empty inbox. Throw so the failure surfaces in
      // server logs and the caller reports it honestly.
      if (!result.success) {
        throw new Error(result.error || "Failed to send password reset email.");
      }
    },
  },

  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google"],
      // Secure default (true): a Google identity may only link to a local
      // row whose email is verified. This closes account pre-hijacking:
      // without it, an attacker could pre-register victim@email.com with
      // their own password, and the victim's later "Continue with Google"
      // would link into the attacker's row — leaving the attacker with
      // working password access to the victim's account.
      // Trade-off: a guest-checkout buyer (isGuest rows are never
      // email-verified) gets rejected on their first Google attempt and
      // must verify their email first (one click from their inbox, which
      // they control — order emails already go there). Friction, not a
      // lockout — and the safe direction to err in.
      requireLocalEmailVerified: true,
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    // After the user clicks the verification link, create the session
    // immediately — landing verified-but-logged-out on the homepage
    // looks broken. better-auth sets the session cookie on the
    // verify-email response, then redirects to the callbackURL.
    autoSignInAfterVerification: true,
    async sendVerificationEmail({ user, url }) {
      const { sendEmail, generateVerificationEmail } = await import(
        "@/lib/email"
      );
      const result = await sendEmail({
        to: user.email,
        subject: "Verify your Kalaa Bhadra email",
        html: generateVerificationEmail({
          userName: user.name || "Collector",
          verificationUrl: url,
        }),
        templateType: "EMAIL_VERIFICATION",
      });
      // Never swallow send failures: a silent "success" here is how users
      // end up staring at an empty inbox while the UI claims the mail was
      // sent. Throw so the failure surfaces in server logs and the caller
      // reports it honestly. (The resend endpoint still answers success to
      // the client for anti-enumeration; the real error lands in logs.)
      if (!result.success) {
        throw new Error(result.error || "Failed to send verification email.");
      }
    },
  },

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24,      // refresh session every 24h
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minute cache
    },
  },

  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "CUSTOMER",
        input: false, // never set from client
      },
    },
  },
});

// Export the type for use in server components and actions
export type Session = typeof auth.$Infer.Session;
