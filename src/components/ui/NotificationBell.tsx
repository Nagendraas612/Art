"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  getNotificationsAction,
  getUnreadCountAction,
  markNotificationReadAction,
  markAllNotificationsReadAction,
} from "@/app/actions/notifications";
import styles from "./NotificationBell.module.css";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  refType: string | null;
  refId: string | null;
  isRead: boolean;
  createdAt: Date;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchUnread = useCallback(async () => {
    try {
      const count = await getUnreadCountAction();
      setUnreadCount(count);
    } catch (err) {
      console.error(err);
    }
  }, []);

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
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, [fetchUnread]);

  useEffect(() => {
    if (open) {
      fetchNotifications();
    }
  }, [open, fetchNotifications]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleToggle = () => {
    setOpen((prev) => !prev);
  };

  const handleMarkRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await markNotificationReadAction(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsReadAction();
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  };

  const formatTime = (date: Date | string) => {
    const d = new Date(date);
    const now = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const getNotificationLink = (n: NotificationItem) => {
    if (n.refType === "order" && n.refId) return `/orders/${n.refId}`;
    if (n.refType === "commission") return `/studio/commissions`;
    if (n.refType === "message") return `/messages`;
    if (n.refType === "artwork" && n.refId) return `/artworks/${n.refId}`;
    return "/notifications";
  };

  return (
    <div className={styles.container} ref={dropdownRef}>
      <button
        type="button"
        className={`${styles.bellBtn} ${unreadCount > 0 ? styles.hasUnread : ""}`}
        onClick={handleToggle}
        aria-label={`Notifications (${unreadCount} unread)`}
        title="Notifications"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className={styles.badge}>
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className={styles.dropdown}>
          <div className={styles.header}>
            <div className={styles.headerTitle}>
              <h3>Notifications</h3>
              {unreadCount > 0 && (
                <span className={styles.unreadPill}>{unreadCount} new</span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                className={styles.markAllBtn}
                onClick={handleMarkAllRead}
              >
                Mark all read
              </button>
            )}
          </div>

          <div className={styles.list}>
            {loading ? (
              <div className={styles.loading}>
                <span className={styles.spinner} />
                Loading updates...
              </div>
            ) : notifications.length === 0 ? (
              <div className={styles.empty}>
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                <p>No notifications yet</p>
                <span>Activity regarding your orders, messages, and saved artists will appear here.</span>
              </div>
            ) : (
              notifications.slice(0, 5).map((n) => (
                <Link
                  key={n.id}
                  href={getNotificationLink(n)}
                  className={`${styles.item} ${!n.isRead ? styles.unreadItem : ""}`}
                  onClick={() => {
                    if (!n.isRead) markNotificationReadAction(n.id);
                    setOpen(false);
                  }}
                >
                  <div className={styles.itemDotWrap}>
                    {!n.isRead ? (
                      <span className={styles.unreadDot} />
                    ) : (
                      <span className={styles.readDot} />
                    )}
                  </div>
                  <div className={styles.itemContent}>
                    <div className={styles.itemTop}>
                      <span className={styles.itemTitle}>{n.title}</span>
                      <span className={styles.itemTime}>{formatTime(n.createdAt)}</span>
                    </div>
                    {n.body && <p className={styles.itemBody}>{n.body}</p>}
                  </div>
                </Link>
              ))
            )}
          </div>

          <div className={styles.footer}>
            <Link
              href="/notifications"
              className={styles.viewAllLink}
              onClick={() => setOpen(false)}
            >
              View all notifications &rarr;
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
