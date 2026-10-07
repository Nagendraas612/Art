import Link from "next/link";
import styles from "../legal.module.css";

export const metadata = {
  title: "Frequently Asked Questions",
  description: "Find answers to common questions about ordering, shipping, returns, artist applications, and more on Kalaa Bhadra.",
};

export default function FAQPage() {
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.kicker}>Help & Support</div>
          <h1 className={styles.title}>Frequently Asked Questions</h1>
          <div className={styles.meta}>Last updated: October 2026</div>
        </div>

        <div className={styles.content}>
          <h2>Ordering & Payment</h2>

          <p><strong>What payment methods do you accept?</strong></p>
          <p>
            We accept all major credit and debit cards, UPI, net banking, and select wallets through our secure payment partner, Razorpay. All transactions are encrypted and PCI-DSS compliant.
          </p>

          <p><strong>Are prices inclusive of tax?</strong></p>
          <p>
            Yes — the price you see is the price you pay. Applicable taxes (GST) are included in the listed artwork price, and you will see the full breakdown, including insured logistics, at checkout before you confirm your order.
          </p>

          <p><strong>Can I commission a custom piece?</strong></p>
          <p>
            Yes! Use the &quot;Send Inquiry&quot; button on any artist&apos;s profile or artwork page to discuss custom orders directly. Custom pricing and timelines are agreed between you and the artisan.
          </p>

          <h2>Shipping & Delivery</h2>

          <p><strong>How are artworks shipped?</strong></p>
          <p>
            Every piece is carefully wrapped in archival-grade, acid-free packaging by the artist&apos;s studio. Shipments are fully insured and tracked via trusted courier partners.
          </p>

          <p><strong>How long does delivery take?</strong></p>
          <p>
            Most pieces ship within 3–7 business days of order confirmation. Delivery times depend on the artist&apos;s studio location and your shipping address. Estimated delivery is shown on each artwork page.
          </p>

          <p><strong>Do you ship internationally?</strong></p>
          <p>
            Currently, we primarily serve India. International shipping availability is expanding — check back soon or contact us at <a href="mailto:nagias612@gmail.com" style={{ textDecoration: "underline" }}>nagias612@gmail.com</a>.
          </p>

          <h2>Returns & Refunds</h2>

          <p><strong>What is your return policy?</strong></p>
          <p>
            Original artworks are unique and generally non-returnable. If you receive a damaged or incorrectly described item, contact us within 48 hours of delivery with photos. We will work with the artist to resolve the issue — including a full refund if warranted.
          </p>

          <p><strong>What if my order arrives damaged?</strong></p>
          <p>
            All shipments are insured. Report damage within 48 hours via <a href="mailto:nagias612@gmail.com" style={{ textDecoration: "underline" }}>nagias612@gmail.com</a> with photographs. We&apos;ll initiate a replacement or full refund immediately.
          </p>

          <h2>Artist Accounts</h2>

          <p><strong>How do I become an artist on Kalaa Bhadra?</strong></p>
          <p>
            Sign up for a free account, then visit the <Link href="/become-a-creator" style={{ textDecoration: "underline" }}>Become a Creator</Link> page. Submit your application with portfolio links and a brief bio. Our curation board reviews every application.
          </p>

          <p><strong>How much do artists earn?</strong></p>
          <p>
            Artists receive 90% of every sale. We charge only a 10% platform fee — no listing fees, no subscription charges, no hidden costs.
          </p>

          <p><strong>Can I track my earnings?</strong></p>
          <p>
            Yes. Approved artists have full access to a Studio Dashboard with real-time sales analytics, order tracking, and payout history.
          </p>

          <h2>Privacy &amp; Your Rights</h2>

          <p><strong>What personal data do you collect about me?</strong></p>
          <p>
            Only what we need to run the marketplace: your name, email, phone, delivery addresses,
            order history, and — if you are an artist — your studio profile and artwork. We never see
            or store your card or UPI details; payments go directly through Razorpay. The full list is
            in our <Link href="/privacy" style={{ textDecoration: "underline" }}>Privacy Policy</Link>.
          </p>

          <p><strong>Do you sell my data?</strong></p>
          <p>
            No. We share data only with the providers needed to fulfil your order — Razorpay (payments),
            Shiprocket and couriers (delivery), and Cloudinary (image hosting) — and never for advertising.
          </p>

          <p><strong>How do I access, correct, or delete my data?</strong></p>
          <p>
            Email <strong>nagias612@gmail.com</strong> with the subject &quot;Data Request&quot; and tell us
            what you need. We will respond within a reasonable time.
          </p>

          <p><strong>How do I raise a complaint?</strong></p>
          <p>
            Contact our grievance officer — <strong>Nagendra A.S</strong>,{" "}
            <strong>nagias612@gmail.com</strong>, <strong>+91 63609 75772</strong>. We acknowledge every
            complaint within 48 hours, resolve it within one month, and give you a ticket number to track it.
          </p>

          <h2>Still Have Questions?</h2>
          <p>
            Reach out to our collector support team at <a href="mailto:nagias612@gmail.com" style={{ textDecoration: "underline" }}>nagias612@gmail.com</a>. We typically respond within 24 hours.
          </p>

          <Link href="/" className={styles.backLink}>
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
