import Link from "next/link";
import styles from "../legal.module.css";

export const metadata = {
  title: "Privacy Policy",
  description: "How Kalaa Bhadra collects, uses, shares, and protects your personal information.",
};

export default function PrivacyPage() {
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.kicker}>Data Protection &amp; Security</div>
          <h1 className={styles.title}>Privacy Policy</h1>
          <div className={styles.meta}>Last updated: October 2026</div>
        </div>

        <div className={styles.content}>
          <p>
            This Privacy Policy explains what personal information <strong>Kalaa Bhadra</strong> collects,
            why we collect it, who we share it with, and what rights you have over it.
            It is written in plain language on purpose — if anything here is unclear, email us and we will explain it.
          </p>

          <h2>1. Who we are</h2>
          <p>
            Kalaa Bhadra is an online marketplace for original Indian artworks, connecting buyers with
            independent creators and studios.
          </p>
          <ul>
            <li><strong>Business name:</strong> [BUSINESS / PROPRIETOR NAME]</li>
            <li><strong>Address:</strong> [BUSINESS ADDRESS]</li>
            <li><strong>Contact email:</strong> [SUPPORT EMAIL]</li>
            <li><strong>Contact phone:</strong> [SUPPORT PHONE]</li>
          </ul>
          <p>
            For any privacy question, complaint, or request about your data, contact our grievance officer
            (details in Section 9).
          </p>

          <h2>2. Information we collect</h2>
          <p>We collect only the information we need to run the marketplace:</p>
          <ul>
            <li><strong>Account details:</strong> your name, email address, and phone number.</li>
            <li><strong>Login credentials:</strong> your password is stored only as a one-way hash — we can never read it. If you sign in with Google, we receive your name and email address from Google, nothing else.</li>
            <li><strong>Delivery addresses:</strong> the name, phone number, and address you give us at checkout so the artwork can reach you.</li>
            <li><strong>Order information:</strong> what you bought, when, for how much, and its delivery status. We store payment <em>references</em> (such as Razorpay order and payment IDs) — <strong>we never see, store, or touch your card numbers, UPI IDs, or bank details.</strong> Payments are processed directly by Razorpay on their secure pages.</li>
            <li><strong>Creator information:</strong> if you apply as a creator — your studio name, bio, portfolio links, and profile details, plus the artwork images and descriptions you upload.</li>
            <li><strong>Messages and support:</strong> messages you exchange with creators or with us, commission requests, reviews, and wishlist items.</li>
            <li><strong>Technical information:</strong> basic device and usage data (such as IP address and pages visited) used for security, fraud prevention, and rate limiting.</li>
          </ul>

          <h2>3. How we use your information</h2>
          <p>Each piece of information is used for a specific purpose:</p>
          <ul>
            <li><strong>Account details and credentials</strong> — to create and secure your account and let you sign in.</li>
            <li><strong>Delivery addresses</strong> — to ship your orders and arrange courier pickup.</li>
            <li><strong>Order and payment information</strong> — to process payments, confirm orders, handle refunds and disputes, and keep tax and accounting records the law requires.</li>
            <li><strong>Creator information and artwork</strong> — to display your storefront and listings to buyers.</li>
            <li><strong>Messages and support history</strong> — to run the marketplace, resolve disputes, and answer your questions.</li>
            <li><strong>Technical information</strong> — to keep the site secure and prevent abuse.</li>
          </ul>
          <p>
            We do not sell your personal information to anyone, and we do not use it for advertising
            by third parties. Marketing emails are sent only if you opt in, and every marketing email
            has an unsubscribe link.
          </p>

          <h2>4. Who we share your information with</h2>
          <p>
            We share your information only with the service providers needed to run the marketplace,
            and only the minimum they need:
          </p>
          <ul>
            <li><strong>Razorpay</strong> — processes your payments. They handle your card, UPI, and banking details directly; we never receive them.</li>
            <li><strong>Shiprocket and courier partners</strong> — receive your name, delivery address, phone number, and email so your artwork can be picked up and delivered, and so you get tracking updates.</li>
            <li><strong>Cloudinary</strong> — hosts the artwork and profile images you upload.</li>
            <li><strong>Google</strong> — only if you choose &quot;Continue with Google&quot;; we receive your name and verified email address to create your account.</li>
            <li><strong>Email provider</strong> — sends transactional emails such as order confirmations and verification links to the address you gave us.</li>
          </ul>
          <p>
            Apart from these providers, we disclose your information only when required by law
            (for example, a lawful order from a court or government authority) or to protect against fraud.
          </p>

          <h2>5. Cookies and similar technologies</h2>
          <p>
            We use a small number of cookies and similar technologies: strictly necessary ones that keep
            you signed in and your cart working, and basic analytics that help us understand how the site
            is used. We do not use advertising or cross-site tracking cookies. You can block cookies in
            your browser settings, but parts of the site (such as staying signed in) may stop working.
          </p>

          <h2>6. How we protect your information</h2>
          <p>We take reasonable steps to keep your information safe:</p>
          <ul>
            <li>All traffic to and from the site is encrypted (HTTPS/TLS).</li>
            <li>Passwords are stored as one-way hashes, never in readable form.</li>
            <li>Access to personal data inside our systems is limited to what each role needs.</li>
            <li>Payment details are handled entirely by our PCI-DSS compliant payment partner.</li>
          </ul>
          <p>
            No system is perfectly secure. If we discover a data breach that affects you, we will inform
            you without unreasonable delay and take the steps the law requires.
          </p>

          <h2>7. How long we keep your information</h2>
          <p>
            We keep your information only for as long as needed for the purposes above. When you delete
            your account or withdraw consent, we delete your personal data within a reasonable time —
            except for records the law requires us to keep, such as order invoices and tax records,
            which we retain for the period required under Indian tax law.
          </p>

          <h2>8. Your rights</h2>
          <p>You have the following rights over your personal information:</p>
          <ul>
            <li><strong>Access</strong> — ask us for a summary of the personal data we hold about you.</li>
            <li><strong>Correction</strong> — ask us to fix anything inaccurate or incomplete.</li>
            <li><strong>Deletion</strong> — ask us to delete your account and personal data (subject to the legal-retention exception in Section 7).</li>
            <li><strong>Withdraw consent</strong> — you can withdraw consent for optional processing (such as marketing emails) at any time; withdrawing consent for essential processing (such as order fulfilment) may mean we can no longer provide the service.</li>
            <li><strong>Nomination</strong> — you may nominate someone to exercise these rights on your behalf in case of your death or incapacity.</li>
          </ul>
          <p>
            To exercise any of these rights, email <strong>[GRIEVANCE EMAIL]</strong> with the subject
            line &quot;Data Request&quot;. We will respond within a reasonable time. If you are not satisfied
            with our response, you may complain to the Data Protection Board of India once it is operational.
          </p>

          <h2>9. Grievance redressal</h2>
          <p>
            If you have any complaint about how we handle your information or your orders, contact our
            grievance officer:
          </p>
          <ul>
            <li><strong>Name:</strong> [GRIEVANCE OFFICER NAME]</li>
            <li><strong>Email:</strong> [GRIEVANCE EMAIL]</li>
            <li><strong>Phone:</strong> [GRIEVANCE PHONE]</li>
          </ul>
          <p>
            We acknowledge every complaint within <strong>48 hours</strong> and resolve it within
            <strong>one month</strong>. You will receive a ticket number to track your complaint.
          </p>

          <h2>10. Children&apos;s privacy</h2>
          <p>
            Kalaa Bhadra is not directed at children under 18, and we do not knowingly collect personal
            information from them. If you believe a child has provided us personal information, contact
            us and we will delete it.
          </p>

          <h2>11. Changes to this policy</h2>
          <p>
            We may update this policy from time to time. The &quot;Last updated&quot; date at the top
            will always show the current version. Significant changes will be announced on the site
            before they take effect.
          </p>

          <h2>12. Contact us</h2>
          <p>
            For anything about this policy or your data: <strong>[SUPPORT EMAIL]</strong>,{" "}
            <strong>[SUPPORT PHONE]</strong>, or write to <strong>[BUSINESS ADDRESS]</strong>.
          </p>

          <p>
            See also our <Link href="/consent-notice" style={{ textDecoration: "underline" }}>Consent Notice</Link>,{" "}
            <Link href="/terms" style={{ textDecoration: "underline" }}>Terms of Use</Link>, and{" "}
            <Link href="/shipping-returns" style={{ textDecoration: "underline" }}>Shipping &amp; Returns</Link> pages.
          </p>

          <Link href="/" className={styles.backLink}>
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
