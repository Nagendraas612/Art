"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/modules/auth/guards";
import { getCurrentCreator } from "@/lib/studio-auth";
import { revalidatePath } from "next/cache";
import { checkRateLimit, rateLimitExceeded } from "@/lib/rate-limit";
import { SAFE_USER_SELECT } from "@/lib/safe-select";
import {
  firstIssue,
  startConversationSchema,
  sendMessageSchema,
  toClientError,
} from "@/lib/validation";

export async function startConversationAction(input: {
  creatorId: string;
  initialMessage?: string;
  orderRefId?: string;
}) {
  try {
    const parsed = startConversationSchema.safeParse(input);
    if (!parsed.success) return { error: firstIssue(parsed.error) };
    const { creatorId, initialMessage, orderRefId } = parsed.data;

    // Identity comes from the session ONLY. Previously a guest could pass any
    // senderEmail, and the action would look up that email and act as the real
    // account holder (or silently mint an unverified user row).
    const session = await getSession();
    const customerId = session?.user?.id;

    if (!customerId) {
      return {
        error: "Please sign in to message artists.",
        code: "UNAUTHENTICATED",
      };
    }

    const rl = await checkRateLimit(`convo:${customerId}`, 10, 60_000);
    if (!rl.allowed) return { error: rateLimitExceeded(rl.retryAfterMs) };

    // Check if conversation already exists between customer and creator
    let conversation = await prisma.conversation.findUnique({
      where: {
        customerId_creatorId: {
          customerId,
          creatorId,
        },
      },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          customerId,
          creatorId,
          orderRefId: orderRefId || null,
        },
      });
    }

    if (initialMessage && initialMessage.trim()) {
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          senderId: customerId,
          body: initialMessage.trim(),
        },
      });
    }

    revalidatePath("/messages");
    revalidatePath("/studio/messages");

    return { success: true, conversationId: conversation.id };
  } catch (err: any) {
    return { error: toClientError("startConversationAction error", err, "Failed to start conversation.") };
  }
}

export async function sendMessageAction(input: {
  conversationId: string;
  body: string;
  attachmentUrl?: string;
}) {
  try {
    const parsed = sendMessageSchema.safeParse(input);
    if (!parsed.success) return { error: firstIssue(parsed.error) };
    const { conversationId, body, attachmentUrl } = parsed.data;

    // Identity comes from the session ONLY. The old client-controlled
    // isCreatorSender flag let anyone who knew a conversationId post as
    // either party.
    const session = await getSession();
    const senderId = session?.user?.id;

    if (!senderId) {
      return {
        error: "Please sign in to send messages.",
        code: "UNAUTHENTICATED",
      };
    }

    const rl = await checkRateLimit(`msg:${senderId}`, 30, 60_000);
    if (!rl.allowed) return { error: rateLimitExceeded(rl.retryAfterMs) };

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        creator: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
                avatarUrl: true,
                role: true,
              },
            },
          },
        },
        customer: true
      },
    });

    if (!conversation) {
      return { error: "Conversation not found." };
    }

    // Membership check: the sender must be a party to this conversation.
    const isParticipant =
      senderId === conversation.customerId ||
      senderId === conversation.creator.userId;
    if (!isParticipant) {
      return { error: "You are not a participant in this conversation." };
    }

    const message = await prisma.message.create({
      data: {
        conversationId,
        senderId,
        body: body.trim(),
        attachments: attachmentUrl
          ? {
              create: [
                {
                  url: attachmentUrl,
                  kind: "image",
                },
              ],
            }
          : undefined,
      },
      include: {
        sender: { select: SAFE_USER_SELECT },
        attachments: true,
      },
    });

    // Identify recipient
    const isSenderCustomer = senderId === conversation.customerId;
    const recipientUser = isSenderCustomer ? conversation.creator.user : conversation.customer;
    const senderName = isSenderCustomer ? conversation.customer.name : conversation.creator.storeName;
    const domain = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const conversationUrl = isSenderCustomer ? `${domain}/studio/messages` : `${domain}/messages`;

    // 1. Create DB Notification
    await prisma.notification.create({
      data: {
        userId: recipientUser.id,
        type: "NEW_MESSAGE",
        title: `New message from ${senderName}`,
        body: body.trim().substring(0, 100) + (body.length > 100 ? "..." : ""),
        refType: "MESSAGE",
        refId: message.id,
      },
    });

    // 2. Dispatch Email
    const { sendEmail, generateNewMessageEmail } = await import("@/lib/email");
    if (recipientUser.email) {
      const emailHtml = generateNewMessageEmail({
        recipientName: recipientUser.name,
        senderName: senderName,
        messageExcerpt: body.trim().substring(0, 150),
        conversationUrl,
      });

      // Fire and forget so we don't block the request
      sendEmail({
        to: recipientUser.email,
        subject: `New Message from ${senderName} — Kalaa Bhadra`,
        html: emailHtml,
      }).catch(console.error);
    }

    revalidatePath("/messages");
    revalidatePath("/studio/messages");

    return { success: true, message };
  } catch (err: any) {
    return { error: toClientError("sendMessageAction error", err, "Failed to send message.") };
  }
}
