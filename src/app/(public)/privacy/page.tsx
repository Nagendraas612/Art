import Link from "next/link";
import styles from "../legal.module.css";

export const metadata = {
  title: "Privacy Policy | Atelier & Co.",
  description: "Privacy policy and data protection practices for Atelier & Co.",
};

export default function PrivacyPage() {
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.kicker}>Data Protection &amp; Security</div>
          <h1 className={styles.title}>Privacy Policy</h1>
          <div className={styles.meta}>Last updated: September 2026</div>
        </div>

        <div className={styles.content}>
          <p>
            At <strong>Atelier &amp; Co.</strong>, we prioritize the protection and confidentiality of your personal information. This Privacy Policy details how we collect, handle, and secure your data.
          </p>

          <h2>1. Information We Collect</h2>
          <p>
            We collect information you provide directly during account registration, profile curation, and checkout:
          </p>
          <ul>
            <li>Name, email address, and authentication credentials.</li>
            <li>Shipping address and contact details for artwork delivery.</li>
            <li>Direct commission requests and creator communication history.</li>
          </ul>

          <h2>2. How We Use Your Data</h2>
          <p>
            Your information is used strictly to process orders, facilitate direct buyer-artisan communication, generate order certificates, and dispatch transactional notifications.
          </p>

          <h2>3. Social Authentication (Google)</h2>
          <p>
            When authenticating via Google OAuth, we receive only basic profile information (your verified name and email address) necessary to provision your secure marketplace profile. We never access private personal files or unrelated data.
          </p>

          <h2>4. Security &amp; Encryption</h2>
          <p>
            All network communication and transactional data are encrypted via TLS/HTTPS. Payment credentials are tokenized directly with certified PCI-DSS compliant gateways.
          </p>

          <Link href="/sign-in" className={styles.backLink}>
            ← Return to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
