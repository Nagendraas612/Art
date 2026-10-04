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

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    // When an email provider is configured, users must verify their email
    // before they can sign in. Google OAuth users are inherently verified.
    requireEmailVerification: emailProviderConfigured,
    async sendResetPassword({ user, url }) {
      const { sendEmail, generatePasswordResetEmail } = await import("@/lib/email");
      await sendEmail({
        to: user.email,
        subject: "Reset your Kalaa Bhadra password",
        html: generatePasswordResetEmail({
          userName: user.name || "Artisan Collector",
          resetUrl: url,
        }),
      });
    },
  },

  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google"],
      // Google cryptographically proves email ownership, so its verification
      // is the trust anchor here. Requiring the *local* row to be verified
      // would lock out every guest-checkout buyer (isGuest rows are never
      // email-verified) the first time they use Google login — better-auth
      // rejects the link with ?error=account_not_linked.
      requireLocalEmailVerified: false,
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
      await sendEmail({
        to: user.email,
        subject: "Verify your Kalaa Bhadra email",
        html: generateVerificationEmail({
          userName: user.name || "Collector",
          verificationUrl: url,
        }),
        templateType: "EMAIL_VERIFICATION",
      });
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
