import { Prisma } from "@prisma/client";

/**
 * Safe subset of User fields that can be serialized to the browser.
 * NEVER include passwordHash, emailVerifiedAt, or other sensitive fields
 * in server-action return values.
 */
export const SAFE_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  image: true,
  avatarUrl: true,
  role: true,
} satisfies Prisma.UserSelect;
