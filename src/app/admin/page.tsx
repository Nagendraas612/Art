import Link from "next/link";
import { getAdminOverviewStatsAction } from "@/app/actions/admin";
import styles from "./overview.module.css";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const res = await getAdminOverviewStatsAction();
  const data = res.data;

  if (!res.success || !data) {
    return (
      <div className={styles.header}>
        <h1 className={styles.title}>Operations Overview</h1>
        <p style={{ color: "#c2410c", marginTop: 12 }}>
          Failed to load operations metrics: {res.error || "Unknown error"}
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <h1 className={styles.title}>Operations &amp; Governance Overview</h1>
          <p className={styles.subtitle}>
            Platform commerce velocity, live moderation queues, creator applications, and audit governance.
          </p>
        </div>
        <div className={styles.timestampPill}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          Live Feed Active
        </div>
      </div>

      {/* KPI Cards */}
      <div className={styles.kpiGrid}>
        {/* GMV */}
        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>Gross Merchandise Value</span>
            <div className={styles.kpiIcon}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" x2="12" y1="2" y2="22" />
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </div>
          </div>
          <div className={styles.kpiValue}>₹{data.totalGMV.toLocaleString("en-IN")}</div>
          <div className={styles.kpiFooter}>
            <span>Lifetime processed volume</span>
          </div>
        </div>

        {/* Platform Revenue */}
        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>Platform Fees / Take</span>
            <div className={styles.kpiIcon}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                <polyline points="17 6 23 6 23 12" />
              </svg>
            </div>
          </div>
          <div className={styles.kpiValue}>₹{data.totalPlatformRevenue.toLocaleString("en-IN")}</div>
          <div className={styles.kpiFooter}>
            <Link href="/admin/economics" className={styles.linkTag}>
              Manage rates &amp; rules →
            </Link>
          </div>
        </div>

        {/* Pending Creators */}
        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>Pending Creator Apps</span>
            <div className={styles.kpiIcon}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
          </div>
          <div className={styles.kpiValue}>{data.pendingCreatorsCount}</div>
          <div className={styles.kpiFooter}>
            <Link href="/admin/creators" className={styles.linkTag}>
              Review applications →
            </Link>
          </div>
        </div>

        {/* Pending Artworks */}
        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>Pending Artwork Submissions</span>
            <div className={styles.kpiIcon}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                <circle cx="9" cy="9" r="2" />
                <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
              </svg>
            </div>
          </div>
          <div className={styles.kpiValue}>{data.pendingArtworksCount}</div>
          <div className={styles.kpiFooter}>
            <Link href="/admin/artworks" className={styles.linkTag}>
              Curate submissions →
            </Link>
          </div>
        </div>

        {/* Active Disputes & Reports */}
        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>Trust &amp; Safety Queue</span>
            <div className={styles.kpiIcon}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
              </svg>
            </div>
          </div>
          <div className={styles.kpiValue}>{data.openDisputesCount + data.openReportsCount}</div>
          <div className={styles.kpiFooter}>
            <Link href="/admin/trust-safety" className={styles.linkTag}>
              Resolve disputes →
            </Link>
          </div>
        </div>

        {/* Catalog Numbers */}
        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>Active Directory</span>
            <div className={styles.kpiIcon}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
                <path d="M6 6h10" />
                <path d="M6 10h10" />
              </svg>
            </div>
          </div>
          <div className={styles.kpiValue}>{data.approvedCreatorsCount} <span style={{ fontSize: "16px", color: "#8c867a", fontWeight: 400 }}>Creators</span></div>
          <div className={styles.kpiFooter}>
            <span>{data.publishedArtworksCount} Artworks published live</span>
          </div>
        </div>
      </div>

      {/* Two-Column Quick Triage & Audit */}
      <div className={styles.twoColGrid}>
        {/* Quick Triage Panel */}
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2 className={styles.panelTitle}>Pending Moderation Summary</h2>
            <Link href="/admin/creators" className={styles.linkTag}>
              View all
            </Link>
          </div>

          <div className={styles.actionList}>
            <div className={styles.actionItem}>
              <div className={styles.actionItemLeft}>
                <span className={styles.itemTitle}>Creator Studio Applications</span>
                <span className={styles.itemMeta}>
                  {data.pendingCreatorsCount} applicants awaiting portfolio &amp; background verification
                </span>
              </div>
              <Link href="/admin/creators" className={styles.linkTag}>
                Review
              </Link>
            </div>

            <div className={styles.actionItem}>
              <div className={styles.actionItemLeft}>
                <span className={styles.itemTitle}>Artwork Listings Under Review</span>
                <span className={styles.itemMeta}>
                  {data.pendingArtworksCount} pieces awaiting visual standards &amp; dimension approval
                </span>
              </div>
              <Link href="/admin/artworks" className={styles.linkTag}>
                Curate
              </Link>
            </div>

            <div className={styles.actionItem}>
              <div className={styles.actionItemLeft}>
                <span className={styles.itemTitle}>Open Patron Disputes</span>
                <span className={styles.itemMeta}>
                  {data.openDisputesCount} order escalations requiring mediator resolution
                </span>
              </div>
              <Link href="/admin/trust-safety" className={styles.linkTag}>
                Resolve
              </Link>
            </div>
          </div>
        </div>

        {/* Live Audit Stream */}
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2 className={styles.panelTitle}>Platform Audit Stream</h2>
            <Link href="/admin/audit" className={styles.linkTag}>
              Full log →
            </Link>
          </div>

          <div className={styles.auditStream}>
            {data.recentAuditLogs.length === 0 ? (
              <p style={{ color: "#8c867a", fontSize: "13px", padding: "16px 0" }}>
                No recent audit actions recorded.
              </p>
            ) : (
              data.recentAuditLogs.map((log) => (
                <div key={log.id} className={styles.auditRow}>
                  <span className={styles.auditBadge}>{log.action}</span>
                  <div className={styles.auditDetails}>
                    <div>
                      <span className={styles.auditActor}>{log.actorName}</span>
                      <span style={{ color: "#7a7469" }}> on {log.targetType.toLowerCase()}</span>
                    </div>
                    <span className={styles.auditTime}>
                      {new Date(log.createdAt).toLocaleString("en-IN", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Recent Platform Orders Table */}
      <div className={styles.tableContainer}>
        <div className={styles.panelHeader} style={{ marginBottom: 16 }}>
          <h2 className={styles.panelTitle}>Recent Platform Orders</h2>
          <span style={{ fontSize: "13px", color: "#8c867a" }}>Showing last 5 purchases</span>
        </div>

        {data.recentOrders.length === 0 ? (
          <p style={{ color: "#8c867a", fontSize: "13px", padding: "16px 0" }}>
            No platform transactions recorded yet.
          </p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Order #</th>
                <th>Customer</th>
                <th>Primary Artwork</th>
                <th>Items</th>
                <th>Grand Total</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {data.recentOrders.map((order) => (
                <tr key={order.id}>
                  <td style={{ fontWeight: 600, fontFamily: "monospace" }}>{order.orderNumber}</td>
                  <td>{order.customerName}</td>
                  <td>{order.firstItemTitle}</td>
                  <td>{order.itemCount}</td>
                  <td style={{ fontWeight: 600 }}>₹{order.grandTotal.toLocaleString("en-IN")}</td>
                  <td>
                    <span
                      className={`${styles.statusPill} ${
                        order.status === "DELIVERED" || order.status === "ORDER_CONFIRMED"
                          ? styles.statusSuccess
                          : order.status === "PENDING_PAYMENT"
                          ? styles.statusPending
                          : styles.statusFailed
                      }`}
                    >
                      {order.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td style={{ color: "#7a7469", fontSize: "12.5px" }}>
                    {new Date(order.createdAt).toLocaleDateString("en-IN", {
                      month: "short",
                      day: "numeric",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
