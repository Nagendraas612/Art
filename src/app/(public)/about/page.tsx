import Link from "next/link";
import styles from "../legal.module.css";

export const metadata = {
  title: "About Us | Kalaa Bhadra",
  description: "Kalaa Bhadra is a curated marketplace connecting discerning collectors with independent master artisans worldwide.",
};

export default function AboutPage() {
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.kicker}>Our Story</div>
          <h1 className={styles.title}>About Kalaa Bhadra</h1>
          <div className={styles.meta}>Founded 2026 · Fine Art & Artisan Marketplace</div>
        </div>

        <div className={styles.content}>
          <p>
            <strong>Kalaa Bhadra</strong> (कला भद्र — &quot;art that is noble&quot;) is a curated sanctuary for exceptional original art, artisanal craft, and limited-edition creations by independent artists worldwide.
          </p>

          <h2>Our Mission</h2>
          <p>
            We believe every handcrafted piece carries the fingerprint of its maker. Our mission is to build the most trusted bridge between discerning collectors and independent master artisans — eliminating middlemen, ensuring fair compensation, and preserving the provenance of every work.
          </p>

          <h2>How It Works</h2>
          <ul>
            <li><strong>For Collectors:</strong> Browse museum-grade originals, limited editions, and bespoke commissions — each accompanied by a Certificate of Authenticity and insured shipping.</li>
            <li><strong>For Creators:</strong> Apply to join our curated collective. Approved artisans receive a personal studio storefront, direct messaging with buyers, and an industry-leading 90% revenue share.</li>
          </ul>

          <h2>Our Curation Standard</h2>
          <p>
            Every creator application is reviewed by our curation board. We look for originality, craftsmanship integrity, and artistic vision. This means every piece you discover on Kalaa Bhadra has passed a quality standard that mass marketplaces simply cannot match.
          </p>

          <h2>Fair Creator Economics</h2>
          <p>
            Creators keep 90% of every sale. Our 10% platform fee covers payment processing, customer support, and platform infrastructure. No hidden fees, no listing charges, no subscription traps.
          </p>

          <h2>Get in Touch</h2>
          <p>
            Questions? Collaboration proposals? Reach us at <a href="mailto:support@kalaabhadra.com" style={{ textDecoration: "underline" }}>support@kalaabhadra.com</a>.
          </p>

          <Link href="/" className={styles.backLink}>
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
