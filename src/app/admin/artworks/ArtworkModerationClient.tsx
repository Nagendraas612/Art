"use client";

import { useState, useTransition } from "react";
import { moderateArtworkAction } from "@/app/actions/admin";
import styles from "./artworks.module.css";

interface ArtworkImage {
  id: string;
  url: string;
  altText: string | null;
}

interface Artwork {
  id: string;
  title: string;
  slug: string;
  description: string;
  price: number;
  currency: string;
  productType: string;
  status: string;
  stock: number;
  stockStatus: string;
  specifications: any;
  rejectionReason: string | null;
  categoryName: string;
  creatorName: string;
  creatorHandle: string;
  creatorUserEmail: string;
  images: ArtworkImage[];
  createdAt: string;
  updatedAt: string;
}

type FilterTab = "ALL" | "SUBMITTED" | "UNDER_REVIEW" | "DRAFT" | "PUBLISHED" | "REJECTED" | "ARCHIVED";

export function ArtworkModerationClient({ initialArtworks }: { initialArtworks: Artwork[] }) {
  const [artworks, setArtworks] = useState<Artwork[]>(initialArtworks);
  const [filter, setFilter] = useState<FilterTab>("ALL");
  const [isPending, startTransition] = useTransition();
  const [activeActionId, setActiveActionId] = useState<string | null>(null);

  const filtered = artworks.filter((a) => {
    if (filter === "ALL") return true;
    return a.status === filter;
  });

  const counts: Record<FilterTab, number> = {
    ALL: artworks.length,
    SUBMITTED: artworks.filter((a) => a.status === "SUBMITTED").length,
    UNDER_REVIEW: artworks.filter((a) => a.status === "UNDER_REVIEW").length,
    DRAFT: artworks.filter((a) => a.status === "DRAFT").length,
    PUBLISHED: artworks.filter((a) => a.status === "PUBLISHED").length,
    REJECTED: artworks.filter((a) => a.status === "REJECTED").length,
    ARCHIVED: artworks.filter((a) => a.status === "ARCHIVED").length,
  };

  const handleAction = (artworkId: string, action: "APPROVE" | "REJECT" | "ARCHIVE") => {
    let reason: string | undefined = undefined;
    if (action === "REJECT") {
      const input = prompt("Rejection reason:", "Listing does not meet visual curation standards.");
      if (input === null) return;
      reason = input;
    }

    setActiveActionId(artworkId);
    startTransition(async () => {
      const res = await moderateArtworkAction({ artworkId, action, reason });
      if (res.success && res.artwork) {
        setArtworks((prev) =>
          prev.map((a) =>
            a.id === artworkId
              ? { ...a, status: res.artwork!.status, rejectionReason: res.artwork!.rejectionReason }
              : a
          )
        );
      } else {
        alert(res.error || "Failed to moderate artwork");
      }
      setActiveActionId(null);
    });
  };

  const formatSpecs = (specs: any): string[] => {
    if (!specs || typeof specs !== "object") return [];
    return Object.entries(specs)
      .filter(([, v]) => v !== null && v !== undefined && v !== "")
      .slice(0, 4)
      .map(([k, v]) => `${k}: ${v}`);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Artwork Curation &amp; Moderation</h1>
          <p className={styles.subtitle}>
            Review submitted artwork listings, validate imagery, and approve pieces for public display.
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className={styles.filterTabs}>
        {(["ALL", "SUBMITTED", "UNDER_REVIEW", "DRAFT", "PUBLISHED", "REJECTED", "ARCHIVED"] as FilterTab[]).map((tab) => (
          <button
            key={tab}
            className={`${styles.tabBtn} ${filter === tab ? styles.tabBtnActive : ""}`}
            onClick={() => setFilter(tab)}
          >
            <span>{tab === "UNDER_REVIEW" ? "Under Review" : tab.charAt(0) + tab.slice(1).toLowerCase()}</span>
            {counts[tab] > 0 && <span className={styles.tabCount}>{counts[tab]}</span>}
          </button>
        ))}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className={styles.emptyState}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 12px", opacity: 0.5 }}>
            <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
            <circle cx="9" cy="9" r="2" />
            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
          </svg>
          <h3>No artworks match this filter</h3>
          <p style={{ marginTop: 4, fontSize: "13px" }}>
            There are no artwork submissions in the &ldquo;{filter}&rdquo; category.
          </p>
        </div>
      ) : (
        <div className={styles.artworksGrid}>
          {filtered.map((artwork) => {
            const isProcessing = isPending && activeActionId === artwork.id;
            const primaryImage = artwork.images[0];
            const specs = formatSpecs(artwork.specifications);
            const statusClass =
              artwork.status === "PUBLISHED"
                ? styles.statusPublished
                : artwork.status === "REJECTED"
                ? styles.statusRejected
                : artwork.status === "ARCHIVED"
                ? styles.statusArchived
                : styles.statusPending;

            return (
              <div key={artwork.id} className={styles.artworkCard}>
                <div className={styles.imagePreviewArea}>
                  {primaryImage ? (
                    <img
                      className={styles.artworkImg}
                      src={primaryImage.url}
                      alt={primaryImage.altText || artwork.title}
                    />
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#888" }}>
                      No Image
                    </div>
                  )}
                  <span className={`${styles.statusPill} ${statusClass}`}>
                    {artwork.status.replace(/_/g, " ")}
                  </span>
                </div>

                <div className={styles.cardBody}>
                  <span className={styles.categoryTag}>{artwork.categoryName}</span>
                  <h3 className={styles.artworkTitle}>{artwork.title}</h3>
                  <span className={styles.creatorMeta}>
                    By {artwork.creatorName} (@{artwork.creatorHandle})
                  </span>

                  <span className={styles.priceTag}>
                    {artwork.currency === "INR" ? "₹" : artwork.currency}
                    {artwork.price.toLocaleString("en-IN")}
                  </span>

                  {specs.length > 0 && (
                    <div className={styles.specsContainer}>
                      {specs.map((s) => (
                        <span key={s}>{s}</span>
                      ))}
                    </div>
                  )}

                  {artwork.rejectionReason && (
                    <div className={styles.rejectionNote}>
                      <strong>Rejection note:</strong> {artwork.rejectionReason}
                    </div>
                  )}

                  <div className={styles.cardFooter}>
                    <button
                      className={styles.btnArchive}
                      disabled={isProcessing}
                      onClick={() => handleAction(artwork.id, "ARCHIVE")}
                    >
                      Archive
                    </button>

                    <div style={{ display: "flex", gap: "8px" }}>
                      {artwork.status !== "REJECTED" && artwork.status !== "PUBLISHED" && (
                        <button
                          className={styles.btnReject}
                          disabled={isProcessing}
                          onClick={() => handleAction(artwork.id, "REJECT")}
                        >
                          Reject
                        </button>
                      )}
                      {artwork.status !== "PUBLISHED" && (
                        <button
                          className={styles.btnApprove}
                          disabled={isProcessing}
                          onClick={() => handleAction(artwork.id, "APPROVE")}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          Publish
                        </button>
                      )}
                    </div>
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
