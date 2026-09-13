import { prisma } from "@/lib/prisma";
import { getCurrentCreator } from "@/lib/studio-auth";
import { ChatView, ConversationSummary } from "@/components/messaging/ChatView";
import styles from "./studio-messages.module.css";

interface StudioMessagesPageProps {
  searchParams: Promise<{
    conversationId?: string;
  }>;
}

export const metadata = {
  title: "Studio Messages — Creator Studio",
  description: "Manage patron inquiries and commission chats",
};

export default async function StudioMessagesPage({ searchParams }: StudioMessagesPageProps) {
  const { conversationId } = await searchParams;
  const creator = await getCurrentCreator();

  if (!creator) {
    return <div className={styles.empty}>Studio not found.</div>;
  }

  const conversationsData = await prisma.conversation.findMany({
    where: { creatorId: creator.id },
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
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Messages</h1>
          <p className={styles.subtitle}>
            Communicate with applicants, creators, and collectors.
          </p>
        </div>
      </div>

      <ChatView
        conversations={formattedConversations}
        initialActiveId={conversationId}
        currentUserId={creator.userId}
        isStudioView={true}
      />
    </div>
  );
}
