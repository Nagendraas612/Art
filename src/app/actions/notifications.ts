"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/modules/auth/guards";
import { revalidatePath } from "next/cache";
import { cuidSchema, firstIssue, toClientError } from "@/lib/validation";

// NOTE (P8): the old exported `createNotificationAction` was an unauthenticated
// primitive — any client could mint notifications for any userId. Creation now
// lives in `@/lib/notify` (server-internal); this module only exposes
// session-scoped reads and read-state updates.

async function resolveUserId(): Promise<string | null> {
  const session = await getSession();
  return session?.user?.id ?? null;
}

/**
 * Get notifications for the current user.
 */
export async function getNotificationsAction() {
  try {
    const userId = await resolveUserId();
    if (!userId) return { notifications: [] };
    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return { notifications };
  } catch (error) {
    console.error("getNotificationsAction error:", error);
    return { notifications: [] };
  }
}

/**
 * Get unread notification count.
 */
export async function getUnreadCountAction(): Promise<number> {
  try {
    const userId = await resolveUserId();
    if (!userId) return 0;
    return await prisma.notification.count({
      where: { userId, isRead: false },
    });
  } catch {
    return 0;
  }
}

/**
 * Mark a single notification as read.
 * Ownership is enforced: the update is scoped to the session user's own row,
 * so a user cannot flip read-state on someone else's notification (P8).
 */
export async function markNotificationReadAction(notificationId: string) {
  try {
    const parsed = cuidSchema.safeParse(notificationId);
    if (!parsed.success) return { error: firstIssue(parsed.error) };

    const userId = await resolveUserId();
    if (!userId) return { error: "Unauthorized." };
    const updated = await prisma.notification.updateMany({
      where: { id: parsed.data, userId },
      data: { isRead: true },
    });
    if (updated.count === 0) {
      return { error: "Notification not found." };
    }
    revalidatePath("/notifications");
    return { success: true };
  } catch (error) {
    return { error: toClientError("markNotificationReadAction error", error, "Failed to mark notification as read.") };
  }
}

/**
 * Mark all notifications as read for the current user.
 */
export async function markAllNotificationsReadAction() {
  try {
    const userId = await resolveUserId();
    if (!userId) return { error: "Unauthorized." };
    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    revalidatePath("/notifications");
    return { success: true };
  } catch (error) {
    return { error: toClientError("markAllNotificationsReadAction error", error, "Failed to mark all notifications as read.") };
  }
}
