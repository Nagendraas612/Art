import Link from "next/link";
import styles from "../legal.module.css";

export const metadata = {
  title: "Consent Notice",
  description: "What data Kalaa Bhadra collects when you sign up, why, and your rights.",
};

export default function ConsentNoticePage() {
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.kicker}>Your Data, Your Choice</div>
          <h1 className={styles.title}>Consent Notice</h1>
          <div className={styles.meta}>Last updated: October 2026</div>
        </div>

        <div className={styles.content}>
          <p>
            Before you create an account on <strong>Kalaa Bhadra</strong>, here is — in short —
            what we collect, why, and what control you have. The full details are in our{" "}
            <Link href="/privacy" style={{ textDecoration: "underline" }}>Privacy Policy</Link>.
          </p>

          <h2>What we collect when you sign up</h2>
          <ul>
            <li>Your <strong>name</strong>, <strong>email address</strong>, and <strong>phone number</strong> — to create and secure your account.</li>
            <li>Your <strong>password</strong> — stored only as a one-way hash; we can never read it.</li>
            <li>If you choose &quot;Continue with Google&quot; — your <strong>name and verified email address</strong> from Google, nothing else.</li>
          </ul>

          <h2>Why we need it</h2>
          <ul>
            <li>To create your account and let you sign in securely.</li>
            <li>To process your orders, arrange delivery, and send order updates.</li>
            <li>To meet legal requirements such as tax invoicing.</li>
          </ul>
          <p>
            We do not sell your data. Marketing emails are only sent if you separately opt in,
            and you can unsubscribe at any time.
          </p>

          <h2>Your rights</h2>
          <ul>
            <li><strong>Withdraw consent</strong> at any time by emailing <strong>nagias612@gmail.com</strong> — though withdrawing consent for essential processing (like order fulfilment) means we can no longer provide the service.</li>
            <li><strong>Access, correct, or delete</strong> your personal data by emailing the same address with the subject &quot;Data Request&quot;.</li>
            <li><strong>Complain</strong> to the Data Protection Board of India if you are unhappy with how we handled your request.</li>
          </ul>

          <p>
            By creating an account, you confirm you are at least 18 years old and agree to the
            processing described above and in our <Link href="/privacy" style={{ textDecoration: "underline" }}>Privacy Policy</Link>{" "}
            and <Link href="/terms" style={{ textDecoration: "underline" }}>Terms of Use</Link>.
          </p>

          <Link href="/" className={styles.backLink}>
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
