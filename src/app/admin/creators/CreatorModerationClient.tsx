"use client";

import { useState, useTransition } from "react";
import { reviewCreatorApplicationAction } from "@/app/actions/admin";
import styles from "./creators.module.css";

interface Creator {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  handle: string;
  storeName: string;
  tagline: string | null;
  bio: string | null;
  disciplines: string[];
  socialLinks: any;
  coverImageUrl: string | null;
  profileImageUrl: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";
  rejectionReason: string | null;
  approvedAt: string | null;
  suspendedAt: string | null;
  createdAt: string;
  artworksCount: number;
  followersCount: number;
}

export function CreatorModerationClient({ initialCreators }: { initialCreators: Creator[] }) {
  const [creators, setCreators] = useState<Creator[]>(initialCreators);
  const [filter, setFilter] = useState<"ALL" | "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED">("ALL");
  const [isPending, startTransition] = useTransition();
  const [activeActionId, setActiveActionId] = useState<string | null>(null);

  const filtered = creators.filter((c) => {
    if (filter === "ALL") return true;
    return c.status === filter;
  });

  const counts = {
    ALL: creators.length,
    PENDING: creators.filter((c) => c.status === "PENDING").length,
    APPROVED: creators.filter((c) => c.status === "APPROVED").length,
    REJECTED: creators.filter((c) => c.status === "REJECTED").length,
    SUSPENDED: creators.filter((c) => c.status === "SUSPENDED").length,
  };

  const handleAction = (creatorId: string, action: "APPROVE" | "REJECT" | "SUSPEND" | "REINSTATE") => {
    let reason: string | undefined = undefined;
    if (action === "REJECT") {
      const input = prompt("Enter a rejection reason for the applicant:", "Portfolio does not meet gallery requirements.");
      if (input === null) return;
      reason = input;
    }

    setActiveActionId(creatorId);
    startTransition(async () => {
      const res = await reviewCreatorApplicationAction({ creatorId, action, reason });
      if (res.success && res.creator) {
        setCreators((prev) =>
          prev.map((c) =>
            c.id === creatorId
              ? {
                  ...c,
                  status: res.creator.status as any,
                  rejectionReason: res.creator.rejectionReason,
                  approvedAt: res.creator.approvedAt?.toISOString() || null,
                  suspendedAt: res.creator.suspendedAt?.toISOString() || null,
                }
              : c
          )
        );
      } else {
        alert(res.error || "Failed to update creator status");
      }
      setActiveActionId(null);
    });
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Creator Studio Applications</h1>
          <p className={styles.subtitle}>
            Review applications from artisans and studios applying to join the marketplace.
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className={styles.filterTabs}>
        {(["ALL", "PENDING", "APPROVED", "SUSPENDED", "REJECTED"] as const).map((tab) => (
          <button
            key={tab}
            className={`${styles.tabBtn} ${filter === tab ? styles.tabBtnActive : ""}`}
            onClick={() => setFilter(tab)}
          >
            <span>{tab.charAt(0) + tab.slice(1).toLowerCase()}</span>
            <span className={styles.tabCount}>{counts[tab]}</span>
          </button>
        ))}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className={styles.emptyState}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 12px", opacity: 0.5 }}>
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <line x1="17" x2="22" y1="11" y2="11" />
          </svg>
          <h3>No applications in this category</h3>
          <p style={{ marginTop: 4, fontSize: "13px" }}>
            No creator profiles match the current filter selection.
          </p>
        </div>
      ) : (
        <div className={styles.creatorsGrid}>
          {filtered.map((creator) => {
            const isProcessing = isPending && activeActionId === creator.id;

            return (
              <div key={creator.id} className={styles.creatorCard}>
                <div
                  className={styles.coverContainer}
                  style={{
                    backgroundImage: creator.coverImageUrl ? `url(${creator.coverImageUrl})` : undefined,
                  }}
                />

                <div className={styles.cardBody}>
                  <div
                    className={styles.avatarOverlap}
                    style={{
                      backgroundImage: creator.profileImageUrl ? `url(${creator.profileImageUrl})` : undefined,
                    }}
                  >
                    {!creator.profileImageUrl && creator.storeName.charAt(0)}
                  </div>

                  <span
                    className={`${styles.statusTag} ${
                      creator.status === "PENDING"
                        ? styles.statusPending
                        : creator.status === "APPROVED"
                        ? styles.statusApproved
                        : creator.status === "REJECTED"
                        ? styles.statusRejected
                        : styles.statusSuspended
                    }`}
                  >
                    {creator.status}
                  </span>

                  <div className={styles.cardInfo}>
                    <h3 className={styles.storeTitle}>{creator.storeName}</h3>
                    <span className={styles.handle}>@{creator.handle}</span>
                    <span className={styles.applicant}>
                      {creator.userName} • {creator.userEmail}
                    </span>
                  </div>

                  {creator.bio && <p className={styles.bio}>{creator.bio}</p>}

                  {creator.disciplines?.length > 0 && (
                    <div className={styles.disciplinesList}>
                      {creator.disciplines.map((d) => (
                        <span key={d} className={styles.disciplinePill}>
                          {d}
                        </span>
                      ))}
                    </div>
                  )}

                  {creator.rejectionReason && (
                    <div className={styles.rejectionBanner}>
                      <strong>Rejection note:</strong> {creator.rejectionReason}
                    </div>
                  )}

                  <div className={styles.cardFooter}>
                    {creator.status === "PENDING" && (
                      <>
                        <button
                          className={styles.btnReject}
                          disabled={isProcessing}
                          onClick={() => handleAction(creator.id, "REJECT")}
                        >
                          Reject
                        </button>
                        <button
                          className={styles.btnApprove}
                          disabled={isProcessing}
                          onClick={() => handleAction(creator.id, "APPROVE")}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          Approve Studio
                        </button>
                      </>
                    )}

                    {creator.status === "APPROVED" && (
                      <button
                        className={styles.btnSuspend}
                        disabled={isProcessing}
                        onClick={() => handleAction(creator.id, "SUSPEND")}
                      >
                        Suspend Studio
                      </button>
                    )}

                    {creator.status === "SUSPENDED" && (
                      <button
                        className={styles.btnApprove}
                        disabled={isProcessing}
                        onClick={() => handleAction(creator.id, "REINSTATE")}
                      >
                        Reinstate Studio
                      </button>
                    )}

                    {creator.status === "REJECTED" && (
                      <button
                        className={styles.btnApprove}
                        disabled={isProcessing}
                        onClick={() => handleAction(creator.id, "APPROVE")}
                      >
                        Re-evaluate &amp; Approve
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
