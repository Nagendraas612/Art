import { redirect } from "next/navigation";
import { getSession } from "@/modules/auth/guards";
import { Nav } from "@/components/Nav";
import styles from "./page.module.css";

export default async function Home() {
  const session = await getSession();

  // Logged-in users skip the landing page and go straight to Explore
  if (session?.user) {
    redirect("/explore");
  }

  return (
    <>
      <Nav />
      <main>
        <section className={styles.hero}>
          <div className={styles.heroArt}>
            <div className={`${styles.floatPiece} ${styles.p1}`} />
            <div className={`${styles.floatPiece} ${styles.p2}`} />
            <div className={`${styles.floatPiece} ${styles.p3}`} />
          </div>
          <div className={`wrap ${styles.heroCopy}`}>
            <h1 className={styles.headline}>
              Made by people.
              <br />
              Meant to be kept.
            </h1>
            <p className={styles.subline}>
              Discover original art, handmade creations and unique pieces from
              independent creators.
            </p>
            <div className={styles.ctas}>
              <a href="/explore" className={styles.btnPrimary}>
                Explore Art
              </a>
              <a href="/become-a-creator" className={styles.btnSecondary}>
                Become a Creator
              </a>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
