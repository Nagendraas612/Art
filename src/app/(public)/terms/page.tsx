import Link from "next/link";
import styles from "../legal.module.css";

export const metadata = {
  title: "Terms of Use",
  description: "The terms governing your use of Kalaa Bhadra as a buyer or creator.",
};

export default function TermsPage() {
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.kicker}>Legal &amp; Compliance</div>
          <h1 className={styles.title}>Terms of Use</h1>
          <div className={styles.meta}>Last updated: October 2026</div>
        </div>

        <div className={styles.content}>
          <p>
            These Terms of Use (&quot;Terms&quot;) are a legal agreement between you and{" "}
            <strong>Kalaa Bhadra</strong> (proprietor: Nagendra A.S, #4057, KHB Colony,
            Near Ooty Road, Nanjangud, Karnataka 571301).
            By creating an account, placing an order, or listing artwork on Kalaa Bhadra, you agree to
            these Terms and to our <Link href="/privacy" style={{ textDecoration: "underline" }}>Privacy Policy</Link>.
            If you do not agree, please do not use the platform.
          </p>

          <h2>1. What Kalaa Bhadra is</h2>
          <p>
            Kalaa Bhadra is an online marketplace that connects buyers with independent artists and
            studios selling original artworks and related pieces. Artists list and sell their own work;
            Kalaa Bhadra provides the platform — listings, checkout, payments, and logistics support —
            but each artwork is sold by the artist named on its listing page. Where an artist&apos;s
            business name, address, and contact details are shown, that artist is the seller of record
            for the piece.
          </p>

          <h2>2. Your account</h2>
          <ul>
            <li>You must be at least 18 years old to create an account or place an order.</li>
            <li>You are responsible for keeping your login credentials confidential and for all activity under your account.</li>
            <li>Provide accurate information when registering and keep it up to date.</li>
            <li>One account per person. We may suspend or close accounts that are fraudulent, abusive, or in breach of these Terms.</li>
          </ul>

          <h2>3. Buying artworks</h2>
          <ul>
            <li><strong>Pricing:</strong> All prices are in Indian Rupees (₹) and are inclusive of applicable taxes (GST). The price you see on the artwork page is the price you pay, plus the insured shipping charge shown at checkout — there are no hidden charges.</li>
            <li><strong>Orders:</strong> Placing an order is an offer to buy. Your order is confirmed once payment succeeds and you receive an order confirmation.</li>
            <li><strong>Payments:</strong> Payments are processed securely by our payment partner, <strong>Razorpay</strong>. We never see or store your card numbers, UPI IDs, or bank details. By paying, you also agree to Razorpay&apos;s terms for the transaction.</li>
            <li><strong>Availability:</strong> Original artworks are one of a kind. If a piece becomes unavailable before your payment is confirmed, you will not be charged; if charged, you will be refunded in full.</li>
            <li><strong>Certificates:</strong> Original artworks are accompanied by a certificate of authenticity from the creator.</li>
          </ul>

          <h2>4. Shipping, delivery, and risk</h2>
          <ul>
            <li>Artworks ship directly from the artist&apos;s studio. Dispatch timelines are shown on each artwork page and in our <Link href="/shipping-returns" style={{ textDecoration: "underline" }}>Shipping &amp; Returns</Link> page.</li>
            <li>Every shipment is insured and tracked. Risk of loss or damage in transit is covered by that insurance.</li>
            <li>Please provide a complete and accurate delivery address and phone number — couriers need both to deliver successfully.</li>
          </ul>

          <h2>5. Cancellations, returns, and refunds</h2>
          <ul>
            <li><strong>Before dispatch:</strong> You may cancel your order for a full refund, at no charge to you.</li>
            <li><strong>After dispatch:</strong> Because artworks are unique and handmade, we do not accept returns for change of mind. If your piece arrives damaged or is significantly not as described, report it within 48 hours of delivery (see <Link href="/shipping-returns" style={{ textDecoration: "underline" }}>Shipping &amp; Returns</Link>) — we will arrange a replacement or a full refund.</li>
            <li><strong>Refund timelines:</strong> Approved refunds are initiated within 2 business days and typically reach your original payment method within 5–7 business days, depending on your bank.</li>
            <li><strong>Custom commissions:</strong> Cancellations and refunds for custom pieces follow the terms you agreed with the artist before production began.</li>
          </ul>

          <h2>6. For artists</h2>
          <ul>
            <li><strong>Accurate listings:</strong> Describe your work honestly — correct images, dimensions, medium, and condition. Misleading listings may be removed, and repeated violations can lead to suspension.</li>
            <li><strong>Your work, your rights:</strong> You retain full copyright in your artworks unless you explicitly agree otherwise with a buyer in writing. By listing on Kalaa Bhadra, you grant us a limited licence to display your images and descriptions to operate the marketplace.</li>
            <li><strong>Commission and payouts:</strong> Artists receive 90% of each sale; Kalaa Bhadra retains a 10% platform fee. Your share is credited to your artist balance and paid out per the payout schedule in your studio dashboard. No listing fees, no subscriptions.</li>
            <li><strong>Fulfilment:</strong> Dispatch orders within the timeline stated on your listing, pack to the standards in our <Link href="/shipping-returns" style={{ textDecoration: "underline" }}>Shipping &amp; Returns</Link> page, and provide tracking details promptly.</li>
            <li><strong>Conduct:</strong> Communicate with buyers respectfully and honour agreed commission milestones. We may suspend artists who fail to fulfil orders, misrepresent work, or abuse the platform.</li>
            <li><strong>Your obligations as a seller:</strong> As the seller of record, you are responsible for the accuracy of your listings and for resolving buyer issues in line with these Terms and applicable consumer-protection law.</li>
          </ul>

          <h2>7. Acceptable use</h2>
          <p>You agree not to:</p>
          <ul>
            <li>Use the platform for anything unlawful, fraudulent, or misleading.</li>
            <li>Upload content you do not own or have the right to share.</li>
            <li>Post fake reviews or manipulate ratings.</li>
            <li>Attempt to disrupt, hack, or scrape the platform, or circumvent its security.</li>
            <li>Harass, threaten, or abuse other users or our team.</li>
          </ul>

          <h2>8. Intellectual property</h2>
          <p>
            The Kalaa Bhadra name, logo, and site design belong to us. Artwork images and descriptions
            belong to the artists who uploaded them. Nothing in these Terms transfers ownership of
            anyone&apos;s intellectual property. Do not copy, reproduce, or use content from the site
            without permission.
          </p>

          <h2>9. Liability</h2>
          <ul>
            <li>We work hard to keep the platform reliable, but we provide it &quot;as is&quot; and cannot guarantee it will always be error-free or uninterrupted.</li>
            <li>To the maximum extent permitted by law, our liability for any claim arising from your use of the platform is limited to the amount you paid for the order in question.</li>
            <li>Nothing in these Terms limits your rights under applicable consumer-protection law, which continue to apply.</li>
          </ul>

          <h2>10. Complaints and dispute resolution</h2>
          <ul>
            <li><strong>Talk to us first:</strong> Most issues are resolved quickly through our grievance officer — Nagendra A.S, <strong>nagias612@gmail.com</strong>, <strong>+91 63609 75772</strong>. We acknowledge complaints within 48 hours and resolve them within one month, with a ticket number for tracking.</li>
            <li><strong>Governing law:</strong> These Terms are governed by the laws of India.</li>
            <li><strong>Jurisdiction:</strong> Subject to applicable consumer-protection law, disputes will be subject to the exclusive jurisdiction of the courts at Mysuru, Karnataka.</li>
          </ul>

          <h2>11. Changes to these Terms</h2>
          <p>
            We may update these Terms from time to time. The &quot;Last updated&quot; date at the top
            always shows the current version, and significant changes will be announced on the site
            before they take effect. Continuing to use the platform after changes means you accept them.
          </p>

          <h2>12. Contact</h2>
          <p>
            Questions about these Terms: <strong>nagias612@gmail.com</strong>, <strong>+91 63609 75772</strong>,{" "}
            #4057, KHB Colony, Near Ooty Road, Nanjangud, Karnataka 571301.
          </p>

          <Link href="/" className={styles.backLink}>
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
