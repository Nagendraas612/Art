import { Nav } from "@/components/Nav";

export default function WishlistLoading() {
  return (
    <>
      <Nav />
      <main style={{ minHeight: "100vh", background: "var(--paper)", padding: "40px 0" }}>
        <div className="wrap">
          <div style={{ width: "220px", height: "36px", background: "var(--paper-deep)", borderRadius: "4px", marginBottom: "32px", animation: "pulse 1.5s infinite" }} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "32px" }}>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ height: "360px", background: "var(--paper-deep)", borderRadius: "8px", animation: "pulse 1.5s infinite" }} />
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
