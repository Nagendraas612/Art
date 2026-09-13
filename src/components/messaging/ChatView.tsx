"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { sendMessageAction } from "@/app/actions/messages";
import styles from "./ChatView.module.css";

export interface ConversationSummary {
  id: string;
  creatorId: string;
  creatorStore: string;
  creatorHandle: string;
  creatorAvatar?: string | null;
  customerName: string;
  lastMessage?: string | null;
  lastMessageAt: Date | string;
  unreadCount?: number;
  messages: Array<{
    id: string;
    senderId: string;
    body: string;
    createdAt: Date | string;
    attachments?: Array<{ url: string; kind: string }>;
  }>;
}

interface ChatViewProps {
  conversations: ConversationSummary[];
  initialActiveId?: string;
  currentUserId?: string;
  isStudioView?: boolean;
}

export function ChatView({
  conversations: initialConversations,
  initialActiveId,
  currentUserId,
  isStudioView = false,
}: ChatViewProps) {
  const [conversations, setConversations] = useState<ConversationSummary[]>(initialConversations);
  const [activeId, setActiveId] = useState<string>(
    initialActiveId || initialConversations[0]?.id || ""
  );
  const [newMessage, setNewMessage] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [showAttachmentInput, setShowAttachmentInput] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeConv = conversations.find((c) => c.id === activeId) || conversations[0];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConv?.messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeConv || isSending) return;

    setIsSending(true);

    const res = await sendMessageAction({
      conversationId: activeConv.id,
      body: newMessage.trim(),
      attachmentUrl: attachmentUrl.trim() || undefined,
      isCreatorSender: isStudioView,
    });

    setIsSending(false);

    if (res.success && res.message) {
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id === activeConv.id) {
            return {
              ...c,
              lastMessage: res.message.body,
              lastMessageAt: res.message.createdAt,
              messages: [...c.messages, res.message as any],
            };
          }
          return c;
        })
      );
      setNewMessage("");
      setAttachmentUrl("");
      setShowAttachmentInput(false);
    }
  };

  if (conversations.length === 0) {
    return (
      <div className={styles.emptyContainer}>
        <div className={styles.emptyIcon}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <h2 className={styles.emptyTitle}>No Conversations Yet</h2>
        <p className={styles.emptySubtitle}>
          {isStudioView
            ? "When collectors inquire about your creations or custom requests, inquiries will arrive here."
            : "Connect directly with independent master artists, inquire about custom sizing, provenance, or studio visits."}
        </p>
        {!isStudioView && (
          <Link href="/explore" className={styles.exploreBtn}>
            Discover Artists &amp; Artworks &rarr;
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className={styles.layout}>
      {/* Left Conversations Sidebar */}
      <div className={styles.sidebar}>
        <div className={styles.sidebarHead}>
          <h3 className={styles.sidebarTitle}>
            {isStudioView ? "Conversations" : "Conversations"}
          </h3>
          <span className={styles.convBadge}>{conversations.length}</span>
        </div>

        <div className={styles.convList}>
          {conversations.map((conv) => {
            const isActive = conv.id === activeConv?.id;
            const displayName = isStudioView ? conv.customerName : conv.creatorStore;

            return (
              <button
                key={conv.id}
                type="button"
                onClick={() => setActiveId(conv.id)}
                className={`${styles.convItem} ${isActive ? styles.convItemActive : ""}`}
              >
                <div className={styles.avatar}>
                  {conv.creatorAvatar ? (
                    <img src={conv.creatorAvatar} alt={displayName} />
                  ) : (
                    <span>{displayName.charAt(0)}</span>
                  )}
                </div>
                <div className={styles.convMeta}>
                  <div className={styles.convTopRow}>
                    <strong className={styles.convName}>{displayName}</strong>
                    <span className={styles.convTime}>
                      {new Intl.DateTimeFormat("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      }).format(new Date(conv.lastMessageAt))}
                    </span>
                  </div>
                  <p className={styles.convSnippet}>
                    {conv.lastMessage || "Started conversation..."}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right Chat Stream */}
      {activeConv ? (
        <div className={styles.chatPane}>
          {/* Chat Header */}
          <div className={styles.chatHead}>
            <div className={styles.chatHeadMeta}>
              <div className={styles.chatAvatar}>
                {activeConv.creatorAvatar ? (
                  <img src={activeConv.creatorAvatar} alt={activeConv.creatorStore} />
                ) : (
                  <span>
                    {(isStudioView ? activeConv.customerName : activeConv.creatorStore).charAt(0)}
                  </span>
                )}
              </div>
              <div>
                <h3 className={styles.chatName}>
                  {isStudioView ? activeConv.customerName : activeConv.creatorStore}
                </h3>
                <span className={styles.chatHandle}>
                  {isStudioView
                    ? "Verified Collector"
                    : `@${activeConv.creatorHandle} • Studio Artisan`}
                </span>
              </div>
            </div>

            {!isStudioView && (
              <div className={styles.chatActions}>
                <Link
                  href={`/creators/${activeConv.creatorHandle}/commission`}
                  className={styles.commissionBtn}
                >
                  Commission Bespoke Work
                </Link>
                <Link
                  href={`/creators/${activeConv.creatorHandle}`}
                  className={styles.profileBtn}
                  target="_blank"
                >
                  View Studio ↗
                </Link>
              </div>
            )}
          </div>

          {/* Messages Feed */}
          <div className={styles.messageStream}>
            <div className={styles.encryptedNotice}>
              🔒 End-to-end encrypted &bull; Messages are private and secure
            </div>

            {activeConv.messages.map((m) => {
              // If studio view, messages from creator user are "mine"
              const isMine = currentUserId
                ? m.senderId === currentUserId
                : isStudioView
                ? m.senderId !== activeConv.id
                : true;

              return (
                <div
                  key={m.id}
                  className={`${styles.messageBubble} ${
                    isMine ? styles.bubbleMine : styles.bubbleTheirs
                  }`}
                >
                  <p className={styles.bubbleText}>{m.body}</p>

                  {m.attachments && m.attachments.length > 0 && (
                    <div className={styles.attachmentWrap}>
                      {m.attachments.map((att, i) => (
                        <img key={i} src={att.url} alt="Attachment" className={styles.attachmentImg} />
                      ))}
                    </div>
                  )}

                  <span className={styles.bubbleTime}>
                    {new Intl.DateTimeFormat("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    }).format(new Date(m.createdAt))}
                  </span>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Composer */}
          <form onSubmit={handleSend} className={styles.composer}>
            {showAttachmentInput && (
              <div className={styles.attachmentInputBox}>
                <input
                  type="url"
                  placeholder="Paste image/reference URL (https://...)"
                  value={attachmentUrl}
                  onChange={(e) => setAttachmentUrl(e.target.value)}
                  className={styles.attachmentInput}
                />
                <button
                  type="button"
                  onClick={() => setShowAttachmentInput(false)}
                  className={styles.closeAttBtn}
                >
                  ✕
                </button>
              </div>
            )}

            <div className={styles.composerRow}>
              <button
                type="button"
                onClick={() => setShowAttachmentInput(!showAttachmentInput)}
                className={styles.mediaBtn}
                title="Attach photo or reference"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
              </button>

              <textarea
                rows={1}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend(e);
                  }
                }}
                placeholder={
                  isStudioView
                    ? "Type a message..."
                    : `Message ${activeConv.creatorStore}...`
                }
                className={styles.textarea}
              />

              <button
                type="submit"
                disabled={!newMessage.trim() || isSending}
                className={styles.sendBtn}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
