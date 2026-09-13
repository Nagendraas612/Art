import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/prisma";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  baseURL: process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    async sendResetPassword({ user, url }) {
      const { sendEmail, generatePasswordResetEmail } = await import("@/lib/email");
      await sendEmail({
        to: user.email,
        subject: "Reset your Atelier & Co. password",
        html: generatePasswordResetEmail({
          userName: user.name || "Artisan Collector",
          resetUrl: url,
        }),
      });
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
