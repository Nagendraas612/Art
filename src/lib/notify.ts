import { prisma } from "@/lib/prisma";
import { z } from "zod";

/**
 * Server-internal notification helper (P8).
 *
 * This lives in lib/ — NOT in a "use server" actions module — so no client
 * component can ever import it. Previously `createNotificationAction` was an
 * exported server action, an unauthenticated primitive that let anyone mint
 * notifications for any userId.
 */
const notifySchema = z.object({
  userId: z.string().min(1).max(64),
  type: z.string().trim().min(1).max(60),
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().max(2000).optional(),
  refType: z.string().trim().max(60).optional(),
  refId: z.string().trim().max(64).optional(),
});

export type NotifyInput = z.infer<typeof notifySchema>;

export async function notifyUser(input: NotifyInput) {
  const parsed = notifySchema.safeParse(input);
  if (!parsed.success) {
    throw new Error("Invalid notification input.");
  }
  return prisma.notification.create({
    data: {
      userId: parsed.data.userId,
      type: parsed.data.type,
      title: parsed.data.title,
      body: parsed.data.body || null,
      refType: parsed.data.refType || null,
      refId: parsed.data.refId || null,
      sentAt: new Date(),
    },
  });
}
