import { createAuthClient } from "better-auth/react";

// Detect base URL at runtime so it works on localhost AND on Vercel
// without needing NEXT_PUBLIC_APP_URL to be configured.
const getBaseURL = () => {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
};

export const authClient = createAuthClient({
  baseURL: getBaseURL(),
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
} = authClient;
