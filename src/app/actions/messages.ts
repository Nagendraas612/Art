"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/modules/auth/guards";
import { getCurrentCreator } from "@/lib/studio-auth";
import { revalidatePath } from "next/cache";

export async function startConversationAction({
  creatorId,
  initialMessage,
  orderRefId,
  senderName,
  senderEmail,
}: {
  creatorId: string;
  initialMessage?: string;
  orderRefId?: string;
  senderName?: string;
  senderEmail?: string;
}) {
  try {
    const session = await getSession();
    let customerId = session?.user?.id;

    if (!customerId) {
      const email = senderEmail || "collector@example.com";
      const name = senderName || "Art Patron";

      let user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        user = await prisma.user.create({
          data: { email, name },
        });
      }
      customerId = user.id;
    }

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
    console.error("startConversationAction error:", err);
    return { error: err.message || "Failed to start conversation." };
  }
}

export async function sendMessageAction({
  conversationId,
  body,
  attachmentUrl,
  isCreatorSender = false,
}: {
  conversationId: string;
  body: string;
  attachmentUrl?: string;
  isCreatorSender?: boolean;
}) {
  try {
    if (!body || !body.trim()) {
      return { error: "Message body cannot be empty." };
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { 
        creator: { include: { user: true } },
        customer: true 
      },
    });

    if (!conversation) {
      return { error: "Conversation not found." };
    }

    const session = await getSession();
    let senderId = session?.user?.id;

    if (!senderId) {
      if (isCreatorSender) {
        senderId = conversation.creator.userId;
      } else {
        senderId = conversation.customerId;
      }
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
        sender: true,
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
        subject: `New Message from ${senderName} — Atelier & Co.`,
        html: emailHtml,
      }).catch(console.error);
    }

    revalidatePath("/messages");
    revalidatePath("/studio/messages");

    return { success: true, message };
  } catch (err: any) {
    console.error("sendMessageAction error:", err);
    return { error: err.message || "Failed to send message." };
  }
}
