"use client";

import { useState } from "react";
import styles from "./audit.module.css";

interface AuditLogEntry {
  id: string;
  actorName: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata: any;
  createdAt: string;
}

export function AuditTrailClient({ logs = [], initialLogs = [] }: { logs?: AuditLogEntry[]; initialLogs?: AuditLogEntry[] }) {
  const displayLogs = logs.length > 0 ? logs : initialLogs;
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleMetadata = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const getActionBadgeClass = (action: string): string => {
    if (action.includes("APPROVE") || action.includes("REINSTATE")) return styles.actionApprove;
    if (action.includes("REJECT")) return styles.actionReject;
    if (action.includes("SUSPEND")) return styles.actionSuspend;
    if (action.includes("PAYOUT") || action.includes("COMMISSION")) return styles.actionFinance;
    if (action.includes("DISPUTE") || action.includes("REPORT")) return styles.actionTrust;
    return "";
  };

  const formatAction = (action: string): string => {
    return action.replace(/_/g, " ");
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Platform Audit Trail</h1>
          <p className={styles.subtitle}>
            Comprehensive log of all administrative moderation, economic, and governance actions with metadata diffs.
          </p>
        </div>
      </div>

      {displayLogs.length === 0 ? (
        <div className={styles.emptyState}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 12px", opacity: 0.5 }}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <h3>No audit logs recorded</h3>
          <p style={{ marginTop: 4, fontSize: "13px" }}>
            Actions taken through the admin hub will appear here as an immutable audit trail.
          </p>
        </div>
      ) : (
        <div className={styles.timeline}>
          {displayLogs.map((log) => (
            <div key={log.id} className={styles.timelineItem}>
              <div className={styles.itemLeft}>
                <span className={`${styles.actionBadge} ${getActionBadgeClass(log.action)}`}>
                  {formatAction(log.action)}
                </span>

                <p className={styles.itemDescription}>
                  <span className={styles.itemActorBold}>{log.actorName}</span>
                  {" acted on "}
                  <span className={styles.itemTarget}>
                    {log.targetType.toLowerCase()} #{log.targetId.slice(-6)}
                  </span>
                </p>

                {log.metadata && (
                  <>
                    <button
                      className={styles.metadataToggle}
                      onClick={() => toggleMetadata(log.id)}
                    >
                      {expandedIds.has(log.id) ? "Hide metadata ▲" : "View metadata ▼"}
                    </button>
                    {expandedIds.has(log.id) && (
                      <div className={styles.metadataBox}>
                        {JSON.stringify(log.metadata, null, 2)}
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className={styles.itemRight}>
                <span className={styles.itemTimestamp}>
                  {new Date(log.createdAt).toLocaleString("en-IN", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <span className={styles.itemActorRole}>
                  {log.actorRole}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
