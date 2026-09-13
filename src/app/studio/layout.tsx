import Link from "next/link";
import { getCurrentCreator } from "@/lib/studio-auth";
import styles from "./studio.module.css";

export const metadata = {
  title: "Creator Studio — Atelier & Co.",
  description: "Artisan and Creator Studio Management Dashboard",
};

export default async function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const creator = await getCurrentCreator();

  return (
    <div className={styles.container}>
      {/* Studio Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <Link href="/" className={styles.brandMark}>
            Atelier &amp; Co.
          </Link>
          <span className={styles.studioTag}>Creator Studio</span>
        </div>

        {creator && (
          <div className={styles.creatorProfileCard}>
            <div className={styles.avatarWrap}>
              {creator.profileImageUrl || creator.user?.image ? (
                <img
                  src={creator.profileImageUrl || creator.user.image!}
                  alt={creator.storeName}
                  className={styles.avatarImg}
                />
              ) : (
                <span className={styles.avatarLetter}>{creator.storeName.charAt(0)}</span>
              )}
            </div>
            <div className={styles.profileMeta}>
              <h3 className={styles.storeName}>{creator.storeName}</h3>
              <p className={styles.handle}>@{creator.handle}</p>
            </div>
          </div>
        )}

        <nav className={styles.nav}>
          <div className={styles.navGroup}>
            <span className={styles.navGroupTitle}>Studio Space</span>
            <Link href="/studio" className={styles.navLink}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
              <span>Overview</span>
            </Link>

            <Link href="/studio/artworks" className={styles.navLink}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                <line x1="12" y1="22.08" x2="12" y2="12" />
              </svg>
              <span>Artworks &amp; Craft</span>
            </Link>

            <Link href="/studio/artworks/new" className={styles.navLinkHighlight}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>List New Piece</span>
            </Link>

            <Link href="/studio/orders" className={styles.navLink}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
              <span>Orders &amp; Logistics</span>
            </Link>

            <Link href="/studio/messages" className={styles.navLink}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <span>Messages</span>
            </Link>

            <Link href="/studio/commissions" className={styles.navLink}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
              <span>Commissions</span>
            </Link>

            <Link href="/studio/earnings" className={styles.navLink}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="1" x2="12" y2="23" />
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
              <span>Earnings &amp; Payouts</span>
            </Link>
          </div>

          <div className={styles.navGroup}>
            <span className={styles.navGroupTitle}>Storefront</span>
            {creator && (
              <Link href={`/creators/${creator.handle}`} target="_blank" className={styles.navLink}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
                <span>View Public Profile</span>
              </Link>
            )}

            <Link href="/explore" className={styles.navLink}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
              </svg>
              <span>Marketplace Home</span>
            </Link>
          </div>
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.partnerBadge}>
            <span className={styles.badgeDot} />
            <span>Verified Atelier Partner</span>
          </div>
        </div>
      </aside>

      {/* Main Studio Workspace */}
      <main className={styles.mainContent}>{children}</main>
    </div>
  );
}
