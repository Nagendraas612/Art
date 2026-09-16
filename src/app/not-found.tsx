import Link from "next/link";
import { Nav } from "@/components/Nav";
import styles from "./not-found.module.css";

export default function NotFound() {
  return (
    <>
      <Nav />
      <main className={styles.container}>
        <div className={styles.card}>
          <span className={styles.code}>404</span>
          <h1 className={styles.title}>Work Not Found</h1>
          <p className={styles.description}>
            The page or artwork piece you are seeking does not exist or may have been relocated in our gallery archives.
          </p>
          <div className={styles.actions}>
            <Link href="/explore" className={styles.primaryBtn}>
              Explore Collection
            </Link>
            <Link href="/" className={styles.secondaryBtn}>
              Return Home
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
