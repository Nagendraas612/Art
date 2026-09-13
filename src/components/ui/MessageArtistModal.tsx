"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { startConversationAction } from "@/app/actions/messages";
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
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState(
    artworkTitle
      ? `Hello ${creatorName.split(" ")[0]}, I am inquiring about your piece "${artworkTitle}".`
      : `Hello ${creatorName.split(" ")[0]}, I would like to inquire about your craft studio.`
  );
  const [senderName, setSenderName] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!message.trim()) {
      setError("Please write your inquiry message.");
      return;
    }

    setIsSending(true);

    const res = await startConversationAction({
      creatorId,
      initialMessage: message,
      senderName: senderName || undefined,
      senderEmail: senderEmail || undefined,
    });

    setIsSending(false);

    if (res.error) {
      setError(res.error);
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

            {error && <div className={styles.errorAlert}>{error}</div>}

            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.formGroup}>
                <label htmlFor="modalMessage">Your Message *</label>
                <textarea
                  id="modalMessage"
                  rows={4}
                  required
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Ask about dimensions, framing options, provenance, or custom requests..."
                />
              </div>

              <div className={styles.row}>
                <div className={styles.formGroup}>
                  <label htmlFor="modalName">Your Name</label>
                  <input
                    type="text"
                    id="modalName"
                    placeholder="e.g. Priya Sharma"
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="modalEmail">Your Email</label>
                  <input
                    type="email"
                    id="modalEmail"
                    placeholder="priya@example.com"
                    value={senderEmail}
                    onChange={(e) => setSenderEmail(e.target.value)}
                  />
                </div>
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
          </div>
        </div>
      )}
    </>
  );
}
