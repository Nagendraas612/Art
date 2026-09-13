"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import {
  getNotificationsAction,
  markNotificationReadAction,
  markAllNotificationsReadAction,
} from "@/app/actions/notifications";
import styles from "./notifications.module.css";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  refType: string | null;
  refId: string | null;
  isRead: boolean;
  createdAt: Date | string;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getNotificationsAction();
      if (res.notifications) {
        setNotifications(res.notifications as NotificationItem[]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    await markNotificationReadAction(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsReadAction();
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const displayedNotifications =
    filter === "unread"
      ? notifications.filter((n) => !n.isRead)
      : notifications;

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const formatTime = (date: Date | string) => {
    const d = new Date(date);
    const now = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`;
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "ORDER_CONFIRMATION":
      case "ORDER_STATUS":
        return (
          <div className={`${styles.iconWrap} ${styles.iconOrder}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
          </div>
        );
      case "COMMISSION_INQUIRY":
      case "COMMISSION_STATUS":
        return (
          <div className={`${styles.iconWrap} ${styles.iconCommission}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
          </div>
        );
      case "DIRECT_MESSAGE":
        return (
          <div className={`${styles.iconWrap} ${styles.iconMessage}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
        );
      case "REVIEW":
        return (
          <div className={`${styles.iconWrap} ${styles.iconReview}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </div>
        );
      case "NEW_FOLLOWER":
        return (
          <div className={`${styles.iconWrap} ${styles.iconFollow}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="8.5" cy="7" r="4" />
              <line x1="20" y1="8" x2="20" y2="14" />
              <line x1="23" y1="11" x2="17" y2="11" />
            </svg>
          </div>
        );
      default:
        return (
          <div className={`${styles.iconWrap} ${styles.iconDefault}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </div>
        );
    }
  };

  const getLink = (n: NotificationItem) => {
    if (n.refType === "order" && n.refId) return `/orders/${n.refId}`;
    if (n.refType === "commission") return `/studio/commissions`;
    if (n.refType === "message") return `/messages`;
    if (n.refType === "artwork" && n.refId) return `/artwork/${n.refId}`;
    return null;
  };

  return (
    <>
      <Nav />
      <main className={styles.main}>
        <div className="wrap">
          {/* Header */}
          <div className={styles.header}>
            <div className={styles.headerLeft}>
              <span className={styles.kicker}>Activity &amp; Updates</span>
              <h1 className={styles.title}>Notification Center</h1>
              <p className={styles.subtitle}>
                Stay updated on your orders, messages from artisans, custom commissions, and saved works.
              </p>
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                className={styles.markAllBtn}
                onClick={handleMarkAllRead}
              >
                Mark all as read ({unreadCount})
              </button>
            )}
          </div>

          {/* Filter tabs */}
          <div className={styles.tabsRow}>
            <div className={styles.tabs}>
              <button
                type="button"
                className={`${styles.tab} ${filter === "all" ? styles.activeTab : ""}`}
                onClick={() => setFilter("all")}
              >
                All ({notifications.length})
              </button>
              <button
                type="button"
                className={`${styles.tab} ${filter === "unread" ? styles.activeTab : ""}`}
                onClick={() => setFilter("unread")}
              >
                Unread ({unreadCount})
              </button>
            </div>
          </div>

          {/* List or Empty State */}
          {loading ? (
            <div className={styles.loadingCard}>
              <span className={styles.spinner} />
              <p>Loading your activity...</p>
            </div>
          ) : displayedNotifications.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIconWrap}>
                <svg
                  width="44"
                  height="44"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
              </div>
              <h2 className={styles.emptyTitle}>
                {filter === "unread" ? "No Unread Notifications" : "No Notifications Yet"}
              </h2>
              <p className={styles.emptyText}>
                {filter === "unread"
                  ? "You're all caught up with your latest updates and communications."
                  : "When you acquire artwork, message an artist, or receive custom commission updates, notifications will appear here."}
              </p>
              <Link href="/explore" className={styles.exploreBtn}>
                Explore Featured Artworks &rarr;
              </Link>
            </div>
          ) : (
            <div className={styles.list}>
              {displayedNotifications.map((n) => {
                const link = getLink(n);
                const ItemWrapper = link ? Link : "div";
                const wrapperProps = link
                  ? {
                      href: link,
                      onClick: () => {
                        if (!n.isRead) markNotificationReadAction(n.id);
                      },
                    }
                  : {};

                return (
                  <div
                    key={n.id}
                    className={`${styles.card} ${!n.isRead ? styles.unreadCard : ""}`}
                  >
                    {/* @ts-ignore */}
                    <ItemWrapper {...wrapperProps} className={styles.cardInner}>
                      {getTypeIcon(n.type)}
                      <div className={styles.content}>
                        <div className={styles.topRow}>
                          <h3 className={styles.cardTitle}>{n.title}</h3>
                          <span className={styles.time}>{formatTime(n.createdAt)}</span>
                        </div>
                        {n.body && <p className={styles.body}>{n.body}</p>}
                        {link && (
                          <span className={styles.actionPrompt}>View details &rarr;</span>
                        )}
                      </div>
                    </ItemWrapper>

                    {!n.isRead && (
                      <button
                        type="button"
                        className={styles.readToggleBtn}
                        onClick={(e) => handleMarkRead(n.id, e)}
                        title="Mark as read"
                      >
                        <span className={styles.dot} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
