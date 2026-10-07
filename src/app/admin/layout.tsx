import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { getSession } from "@/modules/auth/guards";
import styles from "./admin.module.css";

export const metadata = {
  title: "Operations Hub — Kalaa Bhadra Admin",
  description: "Platform moderation, curation, economics and trust & safety control center.",
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await getCurrentAdmin();

  if (!admin) {
    const session = await getSession();
    const path = (await headers()).get("x-request-path") || "/admin";
    if (session?.user) {
      // Signed in but not an admin — that's a 403, not a login problem.
      // Bouncing them to /sign-in made it look like their login was broken.
      return (
        <div className={styles.adminWrapper}>
          <div style={{ padding: 48, maxWidth: 520, margin: "0 auto", textAlign: "center" }}>
            <h1 style={{ fontSize: 22, marginBottom: 12 }}>Restricted area</h1>
            <p style={{ color: "#6b5d4f", marginBottom: 20 }}>
              You're signed in as {session.user.email}, but this account doesn't
              have admin access. If you need access, ask a platform administrator.
            </p>
            <Link href="/" style={{ textDecoration: "underline" }}>
              Back to the gallery →
            </Link>
          </div>
        </div>
      );
    }
    // Not signed in — preserve where they were headed.
    redirect(`/sign-in?callbackUrl=${encodeURIComponent(path)}`);
  }

  return (
    <div className={styles.adminWrapper}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.brandArea}>
          <Link href="/admin" className={styles.brandLink}>
            <span className={styles.brandName}>Kalaa Bhadra</span>
            <span className={styles.badgeAdmin}>Operations Control</span>
          </Link>
        </div>

        <nav className={styles.navSection}>
          <div className={styles.sectionHeading}>Platform Command</div>
          <Link href="/admin" className={styles.navLink}>
            <span className={styles.navLinkLeft}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="7" height="9" x="3" y="3" rx="1" />
                <rect width="7" height="5" x="14" y="3" rx="1" />
                <rect width="7" height="9" x="14" y="12" rx="1" />
                <rect width="7" height="5" x="3" y="16" rx="1" />
              </svg>
              Overview
            </span>
          </Link>

          <div className={styles.sectionHeading}>Moderation Queues</div>
          <Link href="/admin/creators" className={styles.navLink}>
            <span className={styles.navLinkLeft}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              Creator Applications
            </span>
          </Link>

          <Link href="/admin/artworks" className={styles.navLink}>
            <span className={styles.navLinkLeft}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                <circle cx="9" cy="9" r="2" />
                <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
              </svg>
              Artwork Curation
            </span>
          </Link>
          <Link href="/admin/artwork-form" className={styles.navLink}>
            <span className={styles.navLinkLeft}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
              Artwork Form Schema
            </span>
          </Link>

          <div className={styles.sectionHeading}>Finance &amp; Operations</div>
          <Link href="/admin/economics" className={styles.navLink}>
            <span className={styles.navLinkLeft}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" x2="12" y1="2" y2="22" />
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
              Economics &amp; Payouts
            </span>
          </Link>
          <Link href="/admin/shipping" className={styles.navLink}>
            <span className={styles.navLinkLeft}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" />
                <path d="M5 12a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2" />
                <path d="M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7" />
                <circle cx="7.5" cy="17.5" r="1.5" />
                <circle cx="16.5" cy="17.5" r="1.5" />
              </svg>
              Shipping Settings
            </span>
          </Link>

          <div className={styles.sectionHeading}>Governance</div>
          <Link href="/admin/trust-safety" className={styles.navLink}>
            <span className={styles.navLinkLeft}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
              </svg>
              Trust &amp; Disputes
            </span>
          </Link>

          <Link href="/admin/audit" className={styles.navLink}>
            <span className={styles.navLinkLeft}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" x2="8" y1="13" y2="13" />
                <line x1="16" x2="8" y1="17" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              Audit Trail
            </span>
          </Link>
        </nav>

        <div className={styles.sidebarFooter}>
          <Link href="/" className={styles.returnLink}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
            Exit to Marketplace
          </Link>
          <Link href="/studio" className={styles.returnLink}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            Switch to Artist Studio
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <div className={styles.mainContent}>
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <span className={styles.breadcrumbs}>Kalaa Bhadra Operations</span>
          </div>
          <div className={styles.topbarRight}>
            <div className={styles.adminProfilePill}>
              <span className={styles.avatarDot} />
              <span>{admin?.name || "Operations Admin"}</span>
              <span style={{ fontSize: "11px", color: "#8a8479" }}>({admin?.role || "ADMIN"})</span>
            </div>
          </div>
        </header>

        <main className={styles.pageBody}>{children}</main>
      </div>
    </div>
  );
}
