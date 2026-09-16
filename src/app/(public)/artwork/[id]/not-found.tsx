import Link from "next/link";
import { Nav } from "@/components/Nav";
import styles from "../../wishlist/wishlist.module.css";

export default function ArtworkNotFound() {
  return (
    <>
      <Nav />
      <main className={styles.main}>
        <div className="wrap" style={{ textAlign: "center", padding: "80px 20px" }}>
          <span style={{ textTransform: "uppercase", letterSpacing: "0.15em", color: "var(--clay)", fontSize: "0.75rem", fontWeight: 600 }}>
            Archive Notice
          </span>
          <h1 style={{ fontFamily: "var(--serif)", fontSize: "2.5rem", fontWeight: 400, color: "var(--ink)", margin: "16px 0" }}>
            Artwork No Longer Available
          </h1>
          <p style={{ fontFamily: "var(--sans)", color: "var(--charcoal)", maxWidth: "500px", margin: "0 auto 32px", lineHeight: "1.6" }}>
            This specific piece is no longer listed in our public catalogue, or may have been acquired into a private collection.
          </p>
          <Link
            href="/explore"
            style={{
              display: "inline-block",
              background: "var(--ink)",
              color: "var(--paper-0)",
              padding: "14px 28px",
              borderRadius: "var(--radius-sm)",
              textDecoration: "none",
              fontFamily: "var(--sans)",
              fontSize: "0.875rem",
              fontWeight: 500,
            }}
          >
            Explore Available Artworks &rarr;
          </Link>
        </div>
      </main>
    </>
  );
}
