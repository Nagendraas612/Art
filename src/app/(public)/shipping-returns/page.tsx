import Link from "next/link";
import styles from "../legal.module.css";

export const metadata = {
  title: "Shipping & Returns",
  description: "Learn about Kalaa Bhadra's shipping process, insured delivery, processing times, and return policy for original artworks.",
};

export default function ShippingReturnsPage() {
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.kicker}>Delivery & Protection</div>
          <h1 className={styles.title}>Shipping &amp; Returns</h1>
          <div className={styles.meta}>Last updated: October 2026</div>
        </div>

        <div className={styles.content}>
          <p>
            Every artwork on <strong>Kalaa Bhadra</strong> is shipped directly from the creator&apos;s studio with the care and precision that fine art demands.
          </p>

          <h2>Packaging Standards</h2>
          <p>
            All pieces are wrapped in archival-grade, acid-free materials. Paintings ship in custom-built rigid mailers or wooden crates. Sculptures and ceramics are cushioned with museum-standard foam inserts. Every parcel is sealed against moisture and impact.
          </p>

          <h2>Insured Delivery</h2>
          <p>
            Every shipment is fully insured from the moment it leaves the creator&apos;s studio until it reaches your doorstep. In the rare event of transit damage, you&apos;re fully covered — no questions asked.
          </p>

          <h2>Processing & Dispatch</h2>
          <ul>
            <li><strong>Standard pieces:</strong> Ship within 3–5 business days after order confirmation.</li>
            <li><strong>Made-to-order commissions:</strong> Timelines vary by artwork complexity. The estimated dispatch window is shown on each artwork&apos;s page and confirmed by the creator.</li>
            <li><strong>Limited editions:</strong> Typically ship within 5–7 business days (printing, numbering, and signing).</li>
          </ul>

          <h2>Tracking</h2>
          <p>
            Once dispatched, you&apos;ll receive a tracking link via email. You can also check order status anytime from your <Link href="/orders" style={{ textDecoration: "underline" }}>Order History</Link> page.
          </p>

          <h2>Domestic Shipping</h2>
          <p>
            We currently ship to all serviceable pin codes across India. Shipping charges are calculated at checkout based on the artwork dimensions, weight, and destination.
          </p>

          <h2>International Shipping</h2>
          <p>
            International shipping is expanding soon. For urgent international inquiries, please contact <a href="mailto:nagias612@gmail.com" style={{ textDecoration: "underline" }}>nagias612@gmail.com</a>.
          </p>

          <h2>Returns Policy</h2>
          <p>
            Due to the unique, handcrafted nature of the artworks, <strong>returns are not accepted for change of mind.</strong> However, we stand behind the quality and accuracy of every listing:
          </p>
          <ul>
            <li><strong>Damaged in transit:</strong> Report within 48 hours of delivery with photos. Full refund or replacement guaranteed.</li>
            <li><strong>Significantly not as described:</strong> If the received piece materially differs from the listing (wrong artwork, wrong dimensions, etc.), contact us within 48 hours. We&apos;ll mediate with the creator and issue a refund if warranted.</li>
            <li><strong>Custom commissions:</strong> Returns for bespoke pieces follow the terms agreed between you and the creator before production began.</li>
          </ul>

          <h2>Refund Timelines</h2>
          <p>
            Approved refunds are initiated within <strong>2 business days</strong> and typically reach
            your original payment method within <strong>5–7 business days</strong>, depending on your bank.
            If a refund has not arrived after 7 business days, contact us with your order number and we will
            trace it with our payment partner.
          </p>

          <h2>Order Cancellation</h2>
          <p>
            You may cancel any order <strong>before it is dispatched</strong> for a full refund at no charge —
            no cancellation fees, ever. Once an order has been handed to the courier, the returns policy above applies.
            To cancel, go to your <Link href="/orders" style={{ textDecoration: "underline" }}>Order History</Link>{" "}
            page or email us with your order number.
          </p>

          <h2>How to Report an Issue</h2>
          <p>
            Email <a href="mailto:nagias612@gmail.com" style={{ textDecoration: "underline" }}>nagias612@gmail.com</a> with your order number and photographs. Our team responds within 24 hours.
          </p>

          <h2>Grievance Officer</h2>
          <p>
            For unresolved complaints, contact our grievance officer: <strong>[GRIEVANCE OFFICER NAME]</strong> —{" "}
            <strong>[GRIEVANCE EMAIL]</strong>, <strong>[GRIEVANCE PHONE]</strong>. We acknowledge every
            complaint within <strong>48 hours</strong> and resolve it within <strong>one month</strong>,
            with a ticket number for tracking.
          </p>

          <Link href="/" className={styles.backLink}>
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
