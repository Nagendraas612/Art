import Link from "next/link";
import styles from "../legal.module.css";

export const metadata = {
  title: "About Us",
  description: "Kalaa Bhadra is a marketplace where independent Indian artists sell original art directly to buyers.",
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
            <strong>Kalaa Bhadra</strong> (कला भद्र — &quot;art that is noble&quot;) is a marketplace for original art and handmade craft, sold directly by independent artists across India.
          </p>

          <h2>Our Mission</h2>
          <p>
            We believe a handmade piece carries the fingerprint of its maker. Our mission is simple: connect buyers directly with independent artists — no middlemen, fair pay for the maker, and proof of authenticity with every work.
          </p>

          <h2>How It Works</h2>
          <ul>
            <li><strong>For Collectors:</strong> Browse originals, limited editions, and custom commissions. Every piece comes with a Certificate of Authenticity and insured shipping.</li>
            <li><strong>For Artists:</strong> Apply to open your studio storefront. Approved artists get direct messaging with buyers and keep most of every sale.</li>
          </ul>

          <h2>Our Curation Standard</h2>
          <p>
            We review every artist application by hand. We look for original work and genuine craftsmanship — so everything you find here meets a standard mass marketplaces can&apos;t match.
          </p>

          <h2>Fair Artist Economics</h2>
          <p>
            Artists keep most of every sale. Our small platform fee covers payment processing, customer support, and running the site. No hidden fees, no listing charges, no subscription traps.
          </p>

          <h2>Get in Touch</h2>
          <p>
            Questions? Collaboration proposals? Reach us at <a href="mailto:nagias612@gmail.com" style={{ textDecoration: "underline" }}>nagias612@gmail.com</a>.
          </p>

          <Link href="/" className={styles.backLink}>
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
