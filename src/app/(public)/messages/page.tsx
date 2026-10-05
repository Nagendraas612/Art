import { prisma } from "@/lib/prisma";
import { getSession } from "@/modules/auth/guards";
import { redirect } from "next/navigation";
import { Nav } from "@/components/Nav";
import { ChatView, ConversationSummary } from "@/components/messaging/ChatView";
import { SAFE_USER_SELECT } from "@/lib/safe-select";
import styles from "./messages.module.css";

interface MessagesPageProps {
  searchParams: Promise<{
    conversationId?: string;
  }>;
}

export const metadata = {
  title: "Messages & Studio Inquiries",
  description: "Private chat with independent master artists and craft studios.",
};

export default async function MessagesPage({ searchParams }: MessagesPageProps) {
  const { conversationId } = await searchParams;
  const session = await getSession();

  // Private conversations must never be visible without a session. Previously
  // an unauthenticated visitor received EVERY conversation platform-wide
  // because the Prisma filter fell back to `undefined`.
  if (!session?.user?.id) {
    redirect("/sign-in?callbackUrl=/messages");
  }
  const userId = session.user.id;

  // Find conversations where user is the customer, OR where user is the creator behind a CreatorProfile
  const conversationsData = await prisma.conversation.findMany({
    where: {
      OR: [
        { customerId: userId },
        { creator: { userId: userId } },
      ],
    },
    include: {
      creator: { include: { user: { select: SAFE_USER_SELECT } } },
      customer: { select: SAFE_USER_SELECT },
      messages: {
        include: { attachments: true },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const formattedConversations: ConversationSummary[] = conversationsData.map((c) => {
    const lastMsg = c.messages[c.messages.length - 1];
    return {
      id: c.id,
      creatorId: c.creatorId,
      creatorStore: c.creator.storeName,
      creatorHandle: c.creator.handle,
      creatorAvatar: c.creator.profileImageUrl || c.creator.user.image,
      customerName: c.customer.name,
      lastMessage: lastMsg?.body || "Inquiry initiated",
      lastMessageAt: lastMsg?.createdAt || c.createdAt,
      messages: c.messages.map((m) => ({
        id: m.id,
        senderId: m.senderId,
        body: m.body,
        createdAt: m.createdAt,
        attachments: m.attachments.map((a) => ({ url: a.url, kind: a.kind })),
      })),
    };
  });

  return (
    <>
      <Nav />
      <main className={styles.main}>
        <div className="wrap">
          <div className={styles.header}>
            <h1 className={styles.title}>Messages</h1>
            <p className={styles.subtitle}>
              Your conversations with creators and admins. Messages are transmitted securely over HTTPS and visible only to you and the other participant.
            </p>
          </div>

          <ChatView
            conversations={formattedConversations}
            initialActiveId={conversationId}
            currentUserId={userId}
            isStudioView={false}
          />
        </div>
      </main>
    </>
  );
}
