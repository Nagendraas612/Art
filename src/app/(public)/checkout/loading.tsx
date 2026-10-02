import { Nav } from "@/components/Nav";

export default function CheckoutLoading() {
  return (
    <>
      <Nav />
      <main style={{ minHeight: "100vh", background: "var(--paper)", padding: "40px 0" }}>
        <div className="wrap">
          <div style={{ width: "240px", height: "36px", background: "var(--paper-deep)", borderRadius: "4px", marginBottom: "32px", animation: "pulse 1.5s infinite" }} />
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: "48px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              <div style={{ height: "200px", background: "var(--paper-deep)", borderRadius: "8px", animation: "pulse 1.5s infinite" }} />
              <div style={{ height: "240px", background: "var(--paper-deep)", borderRadius: "8px", animation: "pulse 1.5s infinite" }} />
            </div>
            <div style={{ height: "320px", background: "var(--paper-deep)", borderRadius: "8px", animation: "pulse 1.5s infinite" }} />
          </div>
        </div>
      </main>
    </>
  );
}
