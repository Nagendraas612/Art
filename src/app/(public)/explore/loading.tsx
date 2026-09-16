import { Nav } from "@/components/Nav";
import styles from "./loading.module.css";

export default function ExploreLoading() {
  return (
    <>
      <Nav />
      <main className={styles.main}>
        <div className={styles.headerSkeleton}>
          <div className="wrap">
            <div className={`${styles.skeleton} ${styles.kicker}`} />
            <div className={`${styles.skeleton} ${styles.title}`} />
            <div className={`${styles.skeleton} ${styles.subtitle}`} />
          </div>
        </div>

        <div className={`wrap ${styles.grid}`}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className={styles.cardSkeleton}>
              <div className={`${styles.skeleton} ${styles.image}`} />
              <div className={styles.content}>
                <div className={`${styles.skeleton} ${styles.lineShort}`} />
                <div className={`${styles.skeleton} ${styles.lineLong}`} />
                <div className={`${styles.skeleton} ${styles.lineMedium}`} />
              </div>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
