import { Nav } from "@/components/Nav";
import styles from "../../explore/loading.module.css";

export default function ArtworkDetailLoading() {
  return (
    <>
      <Nav />
      <main className={styles.main}>
        <div className="wrap" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "48px", paddingTop: "48px" }}>
          <div className={`${styles.skeleton}`} style={{ height: "500px", width: "100%", borderRadius: "4px" }} />
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <div className={`${styles.skeleton}`} style={{ height: "16px", width: "120px" }} />
            <div className={`${styles.skeleton}`} style={{ height: "40px", width: "80%" }} />
            <div className={`${styles.skeleton}`} style={{ height: "24px", width: "140px" }} />
            <div className={`${styles.skeleton}`} style={{ height: "100px", width: "100%" }} />
            <div className={`${styles.skeleton}`} style={{ height: "52px", width: "200px" }} />
          </div>
        </div>
      </main>
    </>
  );
}
