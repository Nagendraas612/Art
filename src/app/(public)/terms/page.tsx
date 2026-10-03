import Link from "next/link";
import styles from "../legal.module.css";

export const metadata = {
  title: "Terms of Use | Kalaa Bhadra",
  description: "Terms of service and platform agreements for Kalaa Bhadra.",
};

export default function TermsPage() {
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.kicker}>Legal &amp; Compliance</div>
          <h1 className={styles.title}>Terms of Use</h1>
          <div className={styles.meta}>Last updated: September 2026</div>
        </div>

        <div className={styles.content}>
          <p>
            Welcome to <strong>Kalaa Bhadra</strong>. These Terms of Use govern your access to and use of our artisanal marketplace, including any purchases, creator storefronts, and direct commissions.
          </p>

          <h2>1. Platform Marketplace &amp; Authenticity</h2>
          <p>
            Kalaa Bhadra connects discerning collectors with independent artisans and studios. Each original artwork and bespoke commission is accompanied by an artisan Certificate of Authenticity.
          </p>

          <h2>2. Buyer Orders &amp; Payments</h2>
          <p>
            All payments are processed securely through certified payment gateways. Funds are held in escrow until the artisan initiates collector-grade packaging and tracked shipment.
          </p>

          <h2>3. Creator Code of Conduct</h2>
          <p>
            Artisans agree to represent pieces accurately, maintain exceptional craftsmanship standards, and fulfill custom commission milestones agreed with buyers.
          </p>

          <h2>4. Intellectual Property</h2>
          <p>
            Artisans retain full copyright and artistic ownership over original works unless an explicit bespoke commercial transfer is executed.
          </p>

          <Link href="/" className={styles.backLink}>
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
