import { Prisma } from "@prisma/client";

/**
 * Safe subset of User fields that can be serialized to the browser.
 * NEVER include passwordHash, emailVerifiedAt, or other sensitive fields
 * in server-action return values.
 *
 * Deliberately excludes `email` (no UI needs another user's address; it
 * only enables harvesting) and `role` (admin-role disclosure aids
 * targeted attacks). Add a field here only with a concrete consumer.
 */
export const SAFE_USER_SELECT = {
  id: true,
  name: true,
  image: true,
  avatarUrl: true,
} satisfies Prisma.UserSelect;
