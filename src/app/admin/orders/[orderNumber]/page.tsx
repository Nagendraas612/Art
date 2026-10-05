import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { redirect } from "next/navigation";
import { DisputeResolver } from "./DisputeResolver";
import styles from "./order-detail.module.css";

export const metadata = {
  title: "Order Detail — Kalaa Bhadra Admin",
};

function fmt(n: number | string) {
  return `₹${Number(n).toLocaleString("en-IN")}`;
}

export default async function AdminOrderPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/sign-in");

  const { orderNumber } = await params;
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: {
      customer: { select: { id: true, name: true, email: true, phone: true } },
      address: true,
      payment: {
        include: {
          transactions: { orderBy: { createdAt: "asc" } },
        },
      },
      items: {
        include: {
          artwork: {
            select: {
              id: true,
              title: true,
              creator: { select: { storeName: true } },
            },
          },
        },
      },
      shipments: {
        include: { trackingEvents: { orderBy: { occurredAt: "desc" }, take: 10 } },
        orderBy: { createdAt: "asc" },
      },
      statusHistory: { orderBy: { createdAt: "asc" } },
      refunds: { orderBy: { requestedAt: "desc" } },
    },
  });

  if (!order) notFound();

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Order #{order.orderNumber}</h1>
          <p className={styles.sub}>
            Placed {new Date(order.createdAt).toLocaleString("en-IN")} ·{" "}
            <span className={styles.status}>{order.status.replace(/_/g, " ")}</span>
          </p>
        </div>
        <Link href="/admin" className={styles.backLink}>
          ← Back to overview
        </Link>
      </div>

      {order.status === "DISPUTED" && (
        <DisputeResolver
          orderId={order.id}
          orderNumber={order.orderNumber}
          paymentStatus={order.payment?.status ?? "UNKNOWN"}
        />
      )}

      <div className={styles.grid}>
        <section className={styles.card}>
          <h2>Customer</h2>
          <p>
            <strong>{order.customer.name || "—"}</strong>
            <br />
            {order.customer.email}
            <br />
            {order.customer.phone || ""}
          </p>
          <h3>Ship to</h3>
          <p>
            {order.address.fullName}
            <br />
            {order.address.line1}
            {order.address.line2 ? `, ${order.address.line2}` : ""}
            <br />
            {order.address.city}, {order.address.state} — {order.address.postalCode}
            <br />
            {order.address.phone}
          </p>
        </section>

        <section className={styles.card}>
          <h2>Payment</h2>
          <p>
            Status: <strong>{order.payment?.status ?? "—"}</strong>
            <br />
            Gateway: {order.payment?.gateway ?? "—"}
            <br />
            Grand total: <strong>{fmt(order.grandTotal.toString())}</strong>
          </p>
          <h3>Gateway transactions</h3>
          {order.payment?.transactions.length ? (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Gateway payment</th>
                  <th>Status</th>
                  <th>At</th>
                </tr>
              </thead>
              <tbody>
                {order.payment.transactions.map((t) => (
                  <tr key={t.id}>
                    <td className={styles.mono}>{t.gatewayEventId || "—"}</td>
                    <td className={styles.mono}>{t.gatewayPaymentId || "—"}</td>
                    <td>{t.status}</td>
                    <td>{new Date(t.createdAt).toLocaleString("en-IN")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className={styles.muted}>No gateway transactions recorded.</p>
          )}
        </section>
      </div>

      <section className={styles.card}>
        <h2>Items ({order.items.length})</h2>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Artwork</th>
              <th>Studio</th>
              <th>Qty</th>
              <th>Unit price</th>
              <th>Line total</th>
              <th>Platform fee</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((i) => (
              <tr key={i.id}>
                <td>{i.titleSnapshot}</td>
                <td>{i.artwork.creator.storeName}</td>
                <td>{i.quantity}</td>
                <td>{fmt(i.unitPrice.toString())}</td>
                <td>{fmt(i.lineTotal.toString())}</td>
                <td>{fmt(i.platformCommission.toString())}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className={styles.grid}>
        <section className={styles.card}>
          <h2>Shipments ({order.shipments.length})</h2>
          {order.shipments.length ? (
            order.shipments.map((s) => (
              <div key={s.id} className={styles.shipment}>
                <p>
                  <strong>{s.carrier || "—"}</strong> · {s.status.replace(/_/g, " ")}
                  <br />
                  Tracking: <span className={styles.mono}>{s.trackingNumber || s.awbCode || "—"}</span>
                  {s.shiprocketOrderId && (
                    <>
                      <br />
                      Shiprocket: <span className={styles.mono}>{s.shiprocketOrderId}</span>
                    </>
                  )}
                  {s.shipmentError && (
                    <>
                      <br />
                      <span className={styles.error}>Error: {s.shipmentError}</span>
                    </>
                  )}
                </p>
                {s.trackingEvents.length > 0 && (
                  <ul className={styles.timeline}>
                    {s.trackingEvents.map((e) => (
                      <li key={e.id}>
                        {e.status.replace(/_/g, " ")} —{" "}
                        {new Date(e.occurredAt).toLocaleString("en-IN")}
                        {e.note ? ` · ${e.note}` : ""}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))
          ) : (
            <p className={styles.muted}>No shipments yet.</p>
          )}
        </section>

        <section className={styles.card}>
          <h2>Refunds ({order.refunds.length})</h2>
          {order.refunds.length ? (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Reason</th>
                  <th>Requested</th>
                </tr>
              </thead>
              <tbody>
                {order.refunds.map((r) => (
                  <tr key={r.id}>
                    <td>{fmt(r.amount.toString())}</td>
                    <td>{r.status}</td>
                    <td>{r.reason || "—"}</td>
                    <td>{new Date(r.requestedAt).toLocaleString("en-IN")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className={styles.muted}>No refunds recorded.</p>
          )}

          <h2 style={{ marginTop: 24 }}>Status timeline</h2>
          <ul className={styles.timeline}>
            {order.statusHistory.map((e) => (
              <li key={e.id}>
                <strong>{e.status.replace(/_/g, " ")}</strong> —{" "}
                {new Date(e.createdAt).toLocaleString("en-IN")}
                {e.note ? <div className={styles.muted}>{e.note}</div> : null}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
