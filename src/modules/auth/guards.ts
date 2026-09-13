import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

/**
 * Get the current session on the server side.
 * Returns null if not authenticated.
 */
export async function getSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  return session;
}

/**
 * Require authentication. Redirects to sign-in if no session.
 * Use this in server components and server actions.
 */
export async function requireAuth() {
  const session = await getSession();
  if (!session) {
    redirect("/sign-in");
  }
  return session;
}

/**
 * Require the CREATOR role with APPROVED status.
 * Redirects to sign-in if unauthenticated, or to home if wrong role.
 */
export async function requireCreator() {
  const session = await requireAuth();
  if (session.user.role !== "CREATOR" && session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") {
    redirect("/");
  }
  return session;
}

/**
 * Require the ADMIN or SUPER_ADMIN role.
 */
export async function requireAdmin() {
  const session = await requireAuth();
  if (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") {
    redirect("/");
  }
  return session;
}

/**
 * Assert that the current user owns a specific resource.
 * Throws an error (not a redirect) — use in server actions where you
 * want a 403-style failure rather than navigation.
 */
export function assertOwnership(
  sessionUserId: string,
  resourceOwnerId: string,
  resourceName = "resource"
) {
  if (sessionUserId !== resourceOwnerId) {
    throw new Error(`You do not have permission to modify this ${resourceName}.`);
  }
}
