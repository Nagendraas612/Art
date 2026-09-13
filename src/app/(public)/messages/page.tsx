import { prisma } from "@/lib/prisma";
import { getSession } from "@/modules/auth/guards";
import { Nav } from "@/components/Nav";
import { ChatView, ConversationSummary } from "@/components/messaging/ChatView";
import styles from "./messages.module.css";

interface MessagesPageProps {
  searchParams: Promise<{
    conversationId?: string;
  }>;
}

export const metadata = {
  title: "Messages & Studio Inquiries — Atelier & Co.",
  description: "Direct encrypted chat with independent master artists and craft studios.",
};

export default async function MessagesPage({ searchParams }: MessagesPageProps) {
  const { conversationId } = await searchParams;
  const session = await getSession();
  let userId = session?.user?.id;

  // Find conversations where user is the customer, OR where user is the creator behind a CreatorProfile
  const conversationsData = await prisma.conversation.findMany({
    where: userId
      ? {
          OR: [
            { customerId: userId },
            { creator: { userId: userId } },
          ],
        }
      : undefined,
    include: {
      creator: { include: { user: true } },
      customer: true,
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
              Your conversations with creators and admins. All messages are end-to-end encrypted.
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
