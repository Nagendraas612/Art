"use client";

import React, { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { startConversationAction } from "@/app/actions/messages";
import { useSession } from "@/lib/auth-client";
import styles from "./MessageArtistModal.module.css";

interface MessageArtistModalProps {
  creatorId: string;
  creatorName: string;
  storeName: string;
  artworkTitle?: string;
  triggerText?: string;
  className?: string;
}

export function MessageArtistModal({
  creatorId,
  creatorName,
  storeName,
  artworkTitle,
  triggerText,
  className,
}: MessageArtistModalProps) {
  const router = useRouter();
  const pathname = usePathname();
  // After sign-in, bring the buyer back to the artwork they were viewing.
  const signInHref = `/sign-in?callbackUrl=${encodeURIComponent(pathname)}`;
  const { data: session, isPending } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState(
    artworkTitle
      ? `Hello ${creatorName.split(" ")[0]}, I am inquiring about your piece "${artworkTitle}".`
      : `Hello ${creatorName.split(" ")[0]}, I would like to inquire about your craft studio.`
  );
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNeedsAuth(false);

    if (!message.trim()) {
      setError("Please write your inquiry message.");
      return;
    }

    setIsSending(true);

    const res = await startConversationAction({
      creatorId,
      initialMessage: message,
    });

    setIsSending(false);

    if (res.error) {
      setError(res.error);
      if ((res as { code?: string }).code === "UNAUTHENTICATED") {
        setNeedsAuth(true);
      }
    } else {
      setIsOpen(false);
      router.push(`/messages?conversationId=${res.conversationId}`);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={className || styles.triggerBtn}
      >
        {triggerText || `Inquire with ${creatorName.split(" ")[0]}`}
      </button>

      {isOpen && (
        <div className={styles.overlay} onClick={() => setIsOpen(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHead}>
              <div>
                <h3 className={styles.modalTitle}>Direct Studio Inquiry</h3>
                <p className={styles.modalSubtitle}>
                  Chat directly with <strong>{storeName}</strong> ({creatorName})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className={styles.closeBtn}
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            {error && (
              <div className={styles.errorAlert}>
                {error}
                {needsAuth && (
                  <>
                    {" "}
                    <Link href={signInHref} className={styles.signInLink}>
                      Sign in →
                    </Link>
                  </>
                )}
              </div>
            )}

            {!isPending && !session ? (
              <div className={styles.signInPrompt}>
                <p>
                  Please sign in to chat directly with{" "}
                  <strong>{storeName}</strong>.
                </p>
                <Link href={signInHref} className={styles.sendBtn}>
                  Sign In to Continue →
                </Link>
              </div>
            ) : (
            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.formGroup}>
                <label htmlFor="modalMessage">Your Message *</label>
                <textarea
                  id="modalMessage"
                  rows={4}
                  required
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Ask about size, framing, history, or custom requests..."
                />
              </div>

              <div className={styles.modalActions}>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className={styles.cancelBtn}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSending}
                  className={styles.sendBtn}
                >
                  {isSending ? "Sending Inquiry..." : "Send Message & Open Chat \u2192"}
                </button>
              </div>
            </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
