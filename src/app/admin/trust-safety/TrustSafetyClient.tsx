"use client";

import { useState, useTransition } from "react";
import { resolveDisputeAction, actionReportAction } from "@/app/actions/admin";
import styles from "./trust-safety.module.css";

interface Dispute {
  id: string;
  orderId: string;
  orderNumber: string;
  grandTotal: number;
  customerName: string;
  customerEmail: string;
  storeName: string;
  reason: string;
  status: string;
  resolution: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

interface Report {
  id: string;
  reporterName: string;
  targetType: string;
  targetId: string;
  reason: string;
  status: string;
  createdAt: string;
  resolvedAt: string | null;
}

type TabType = "disputes" | "reports";

export function TrustSafetyClient({
  initialDisputes,
  initialReports,
}: {
  initialDisputes: Dispute[];
  initialReports: Report[];
}) {
  const [disputes, setDisputes] = useState(initialDisputes);
  const [reports, setReports] = useState(initialReports);
  const [activeTab, setActiveTab] = useState<TabType>("disputes");
  const [isPending, startTransition] = useTransition();
  const [resolutionInputs, setResolutionInputs] = useState<Record<string, string>>({});

  const openDisputes = disputes.filter((d) => d.status === "OPEN" || d.status === "UNDER_REVIEW" || d.status === "ESCALATED");
  const openReports = reports.filter((r) => r.status === "OPEN");

  const handleResolveDispute = (disputeId: string) => {
    const resolution = resolutionInputs[disputeId] || "";
    if (!resolution.trim()) {
      alert("Please enter a resolution summary.");
      return;
    }

    startTransition(async () => {
      const res = await resolveDisputeAction({
        disputeId,
        resolution,
        status: "RESOLVED",
      });
      if (res.success) {
        setDisputes((prev) =>
          prev.map((d) =>
            d.id === disputeId
              ? { ...d, status: "RESOLVED", resolution, resolvedAt: new Date().toISOString() }
              : d
          )
        );
      } else {
        alert(res.error || "Failed to resolve dispute.");
      }
    });
  };

  const handleActionReport = (reportId: string, action: "ACTIONED" | "DISMISSED") => {
    startTransition(async () => {
      const res = await actionReportAction({ reportId, action });
      if (res.success) {
        setReports((prev) =>
          prev.map((r) =>
            r.id === reportId
              ? { ...r, status: action, resolvedAt: new Date().toISOString() }
              : r
          )
        );
      } else {
        alert(res.error || "Failed to process report.");
      }
    });
  };

  const getDisputeStatusClass = (status: string) => {
    switch (status) {
      case "RESOLVED": return styles.statusResolved;
      case "CLOSED": return styles.statusClosed;
      default: return styles.statusOpen;
    }
  };

  const getReportStatusClass = (status: string) => {
    switch (status) {
      case "ACTIONED": return styles.statusActioned;
      case "DISMISSED": return styles.statusDismissed;
      default: return styles.statusOpen;
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Trust &amp; Safety Center</h1>
          <p className={styles.subtitle}>
            Manage order disputes, content reports, and platform integrity actions.
          </p>
        </div>
      </div>

      {/* Tab Bar */}
      <div className={styles.tabBar}>
        <button
          className={`${styles.tabBtn} ${activeTab === "disputes" ? styles.tabBtnActive : ""}`}
          onClick={() => setActiveTab("disputes")}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
          </svg>
          Order Disputes
          <span className={styles.tabCount}>{openDisputes.length}</span>
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === "reports" ? styles.tabBtnActive : ""}`}
          onClick={() => setActiveTab("reports")}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
            <line x1="4" x2="4" y1="22" y2="15" />
          </svg>
          Content Reports
          <span className={styles.tabCount}>{openReports.length}</span>
        </button>
      </div>

      {/* Disputes Tab */}
      {activeTab === "disputes" && (
        disputes.length === 0 ? (
          <div className={styles.emptyState}>
            <h3>No disputes on record</h3>
            <p>All is well — no order disputes have been filed.</p>
          </div>
        ) : (
          <div className={styles.cardsGrid}>
            {disputes.map((dispute) => (
              <div key={dispute.id} className={styles.card}>
                <div className={styles.cardHeader}>
                  <div>
                    <h3 className={styles.cardTitle}>
                      Order #{dispute.orderNumber}
                    </h3>
                    <p className={styles.cardMeta}>
                      {dispute.customerName} • {dispute.storeName} • ₹{dispute.grandTotal.toLocaleString("en-IN")}
                    </p>
                  </div>
                  <span className={`${styles.statusPill} ${getDisputeStatusClass(dispute.status)}`}>
                    {dispute.status}
                  </span>
                </div>

                <div className={styles.reasonQuote}>{dispute.reason}</div>

                {dispute.resolution && (
                  <div className={styles.resolutionBox}>
                    <strong>Resolution:</strong> {dispute.resolution}
                  </div>
                )}

                <p className={styles.cardMeta}>
                  Filed {new Date(dispute.createdAt).toLocaleDateString("en-IN", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                  {dispute.resolvedAt && (
                    <> • Resolved {new Date(dispute.resolvedAt).toLocaleDateString("en-IN", {
                      month: "short",
                      day: "numeric",
                    })}</>
                  )}
                </p>

                {(dispute.status === "OPEN" || dispute.status === "UNDER_REVIEW" || dispute.status === "ESCALATED") && (
                  <div className={styles.cardActions}>
                    <div className={styles.inputRow}>
                      <input
                        className={styles.resolveInput}
                        placeholder="Enter resolution notes…"
                        value={resolutionInputs[dispute.id] || ""}
                        onChange={(e) =>
                          setResolutionInputs((prev) => ({ ...prev, [dispute.id]: e.target.value }))
                        }
                      />
                      <button
                        className={styles.btnResolve}
                        disabled={isPending}
                        onClick={() => handleResolveDispute(dispute.id)}
                      >
                        Resolve
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {/* Reports Tab */}
      {activeTab === "reports" && (
        reports.length === 0 ? (
          <div className={styles.emptyState}>
            <h3>No content reports</h3>
            <p>No user reports have been submitted.</p>
          </div>
        ) : (
          <div className={styles.cardsGrid}>
            {reports.map((report) => (
              <div key={report.id} className={styles.card}>
                <div className={styles.cardHeader}>
                  <div>
                    <h3 className={styles.cardTitle}>
                      {report.targetType} Report
                    </h3>
                    <p className={styles.cardMeta}>
                      Reported by {report.reporterName} • Target: {report.targetType.toLowerCase()} #{report.targetId.slice(-6)}
                    </p>
                  </div>
                  <span className={`${styles.statusPill} ${getReportStatusClass(report.status)}`}>
                    {report.status}
                  </span>
                </div>

                <div className={styles.reasonQuote}>{report.reason}</div>

                <p className={styles.cardMeta}>
                  Filed {new Date(report.createdAt).toLocaleDateString("en-IN", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>

                {report.status === "OPEN" && (
                  <div className={styles.cardActions}>
                    <button
                      className={styles.btnDismiss}
                      disabled={isPending}
                      onClick={() => handleActionReport(report.id, "DISMISSED")}
                    >
                      Dismiss
                    </button>
                    <button
                      className={styles.btnAction}
                      disabled={isPending}
                      onClick={() => handleActionReport(report.id, "ACTIONED")}
                    >
                      Take Action
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
