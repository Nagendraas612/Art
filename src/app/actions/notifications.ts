"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/modules/auth/guards";
import { revalidatePath } from "next/cache";

async function resolveUserId(): Promise<string> {
  const session = await getSession();
  if (session?.user?.id) return session.user.id;

  const email = "collector@example.com";
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: { email, name: "Art Collector", emailVerified: true },
    });
  }
  return user.id;
}

/**
 * Create a notification for a user.
 */
export async function createNotificationAction(input: {
  userId: string;
  type: string;
  title: string;
  body?: string;
  refType?: string;
  refId?: string;
}) {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body || null,
        refType: input.refType || null,
        refId: input.refId || null,
        sentAt: new Date(),
      },
    });
    return { notification };
  } catch (error) {
    console.error("createNotificationAction error:", error);
    return { error: "Failed to create notification." };
  }
}

/**
 * Get notifications for the current user.
 */
export async function getNotificationsAction() {
  try {
    const userId = await resolveUserId();
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
    return await prisma.notification.count({
      where: { userId, isRead: false },
    });
  } catch {
    return 0;
  }
}

/**
 * Mark a single notification as read.
 */
export async function markNotificationReadAction(notificationId: string) {
  try {
    await prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });
    revalidatePath("/notifications");
    return { success: true };
  } catch (error) {
    console.error("markNotificationReadAction error:", error);
    return { error: "Failed to mark notification as read." };
  }
}

/**
 * Mark all notifications as read for the current user.
 */
export async function markAllNotificationsReadAction() {
  try {
    const userId = await resolveUserId();
    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    revalidatePath("/notifications");
    return { success: true };
  } catch (error) {
    console.error("markAllNotificationsReadAction error:", error);
    return { error: "Failed to mark all notifications as read." };
  }
}
