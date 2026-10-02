import { Nav } from "@/components/Nav";
import styles from "./cart.module.css";

export default function CartLoading() {
  return (
    <>
      <Nav />
      <main className={styles.main}>
        <div className="wrap">
          <div style={{ padding: "40px 0" }}>
            <div style={{ width: "200px", height: "32px", background: "var(--paper-deep)", borderRadius: "4px", marginBottom: "24px", animation: "pulse 1.5s infinite" }} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "40px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {[1, 2].map((i) => (
                  <div key={i} style={{ height: "120px", background: "var(--paper-deep)", borderRadius: "8px", animation: "pulse 1.5s infinite" }} />
                ))}
              </div>
              <div style={{ height: "260px", background: "var(--paper-deep)", borderRadius: "8px", animation: "pulse 1.5s infinite" }} />
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
