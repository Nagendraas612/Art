import Link from "next/link";
import styles from "./Footer.module.css";

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={`wrap ${styles.container}`}>
        <div className={styles.grid}>
          {/* Brand Column */}
          <div className={styles.brandCol}>
            <Link href="/" className={styles.logo}>
              Atelier &amp; Co.
            </Link>
            <p className={styles.tagline}>
              A curated sanctuary for exceptional original art, artisanal craft, and limited edition creations by independent artists worldwide.
            </p>
            <div className={styles.badge}>
              <span>Est. 2026</span>
              <span className={styles.dot}>•</span>
              <span>Fine Art Marketplace</span>
            </div>
          </div>

          {/* Navigation Columns */}
          <div className={styles.linksCol}>
            <h4 className={styles.colTitle}>Explore</h4>
            <ul className={styles.linkList}>
              <li><Link href="/explore">All Collections</Link></li>
              <li><Link href="/explore?type=ORIGINAL_PAINTING">Original Paintings</Link></li>
              <li><Link href="/explore?type=PRINTS">Fine Art Prints</Link></li>
              <li><Link href="/explore?type=SCULPTURE">Sculptures &amp; Ceramics</Link></li>
              <li><Link href="/explore?type=DIGITAL_ART">Digital Collectibles</Link></li>
            </ul>
          </div>

          <div className={styles.linksCol}>
            <h4 className={styles.colTitle}>Creators</h4>
            <ul className={styles.linkList}>
              <li><Link href="/creators">Browse Artists</Link></li>
              <li><Link href="/creator/apply">Apply as Creator</Link></li>
              <li><Link href="/studio/artworks">Studio Portal</Link></li>
              <li><Link href="/wishlist">Your Wishlist</Link></li>
            </ul>
          </div>

          <div className={styles.linksCol}>
            <h4 className={styles.colTitle}>Atelier</h4>
            <ul className={styles.linkList}>
              <li><Link href="/orders">Track Orders</Link></li>
              <li><Link href="/sign-in">Account Login</Link></li>
              <li><a href="mailto:support@ateliernco.com">Collector Support</a></li>
            </ul>
          </div>
        </div>

        <div className={styles.bottomBar}>
          <p className={styles.copyright}>
            &copy; {new Date().getFullYear()} Atelier &amp; Co. All rights reserved.
          </p>
          <div className={styles.legalLinks}>
            <span className={styles.trustBadge}>
              🔒 Secure Payments via Cashfree Payments
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
