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
              Kalaa Bhadra
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
              <li><Link href="/explore?type=ORIGINAL">Original Works</Link></li>
              <li><Link href="/explore?type=LIMITED_EDITION">Limited Editions</Link></li>
            </ul>
          </div>

          <div className={styles.linksCol}>
            <h4 className={styles.colTitle}>Creators</h4>
            <ul className={styles.linkList}>
              <li><Link href="/creators">Browse Artists</Link></li>
              <li><Link href="/become-a-creator">Become a Creator</Link></li>
              <li><Link href="/studio/artworks">Studio Portal</Link></li>
              <li><Link href="/wishlist">Your Wishlist</Link></li>
            </ul>
          </div>

          <div className={styles.linksCol}>
            <h4 className={styles.colTitle}>Kalaa Bhadra</h4>
            <ul className={styles.linkList}>
              <li><Link href="/about">About Us</Link></li>
              <li><Link href="/faq">FAQ</Link></li>
              <li><Link href="/shipping-returns">Shipping & Returns</Link></li>
              <li><Link href="/terms">Terms of Use</Link></li>
              <li><Link href="/privacy">Privacy Policy</Link></li>
              <li><a href="mailto:support@kalaabhadra.com">Collector Support</a></li>
            </ul>
          </div>
        </div>

        <div className={styles.bottomBar}>
          <p className={styles.copyright}>
            &copy; {new Date().getFullYear()} Kalaa Bhadra. All rights reserved.
          </p>
          <div className={styles.legalLinks}>
            <span className={styles.trustBadge}>
              🔒 Secure Payments via Razorpay
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
