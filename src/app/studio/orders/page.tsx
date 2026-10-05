import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentCreator } from "@/lib/studio-auth";
import { OrderStatusUpdater } from "@/components/studio/OrderStatusUpdater";
import { RetryShipmentButton } from "@/components/studio/RetryShipmentButton";
import styles from "./orders.module.css";

export default async function StudioOrdersPage() {
  const creator = await getCurrentCreator();

  if (!creator) {
    return <div className={styles.empty}>Studio not found.</div>;
  }

  const orderItems = await prisma.orderItem.findMany({
    where: { creatorId: creator.id },
    include: {
      order: {
        include: {
          address: true,
          payment: true,
          shipments: { orderBy: { createdAt: "desc" } },
          statusHistory: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      },
      artwork: {
        include: { images: { orderBy: { sortOrder: "asc" }, take: 1 } },
      },
    },
    orderBy: { order: { createdAt: "desc" } },
  });

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Studio Orders &amp; Fulfillment</h1>
          <p className={styles.subtitle}>
            Fulfill collector orders, update preparation and tracking details, and monitor shipments.
          </p>
        </div>
      </div>

      {orderItems.length === 0 ? (
        <div className={styles.emptyCard}>
          <h2>No Orders Received Yet</h2>
          <p>When collectors acquire your artworks, your dispatch queue will appear here.</p>
          <Link href="/explore" className={styles.btnExplore}>
            View Marketplace Showcase &rarr;
          </Link>
        </div>
      ) : (
        <div className={styles.ordersGrid}>
          {(() => {
            // Group the creator's line items by order — one card per order,
            // not one card per item (a multi-piece order was three cards).
            const byOrder = new Map<string, typeof orderItems>();
            for (const item of orderItems) {
              const list = byOrder.get(item.order.id);
              if (list) list.push(item);
              else byOrder.set(item.order.id, [item]);
            }
            return Array.from(byOrder.values()).map((items) => {
            const first = items[0];
            const order = first.order;
            const lineTotal = items.reduce((s, i) => s + parseFloat(i.lineTotal.toString()), 0);
            const creatorNet = items.reduce((s, i) => s + parseFloat(i.creatorAmount.toString()), 0);
            const commission = items.reduce((s, i) => s + parseFloat(i.platformCommission.toString()), 0);
            const fmt = (n: number) =>
              new Intl.NumberFormat("en-IN", {
                style: "currency",
                currency: order.currency,
                maximumFractionDigits: 0,
              }).format(n);

            const orderDate = new Intl.DateTimeFormat("en-IN", {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(order.createdAt);

            // C3: don't let creators fulfil unpaid orders. The rows exist
            // because the order was created, not because money moved.
            const isPaid = order.payment?.status === "PAID";

            return (
              <div key={order.id} className={styles.orderCard}>
                <div className={styles.cardTop}>
                  <div>
                    <div className={styles.refRow}>
                      <span className={styles.orderRef}>{order.orderNumber}</span>
                      <span className={styles.orderDate}>{orderDate}</span>
                    </div>
                    <h3 className={styles.artTitle}>
                      {items.length === 1
                        ? items[0].titleSnapshot
                        : `${items.length} pieces`}
                    </h3>
                  </div>

                  <div className={styles.priceMeta}>
                    <span className={styles.totalPrice}>{fmt(lineTotal)}</span>
                    <span className={styles.netShare}>
                      Studio Net: ₹{creatorNet.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>

                <div className={styles.cardBody}>
                  {/* Artworks in this order */}
                  {items.map((item) => {
                    const imgUrl = item.artwork.images[0]?.url || "";
                    return (
                      <div key={item.id} className={styles.detailsRow}>
                        <div className={styles.thumbWrap}>
                          {imgUrl ? <img src={imgUrl} alt={item.titleSnapshot} /> : null}
                        </div>
                        <div className={styles.buyerInfo}>
                          <h4>{item.titleSnapshot}</h4>
                          <p>Qty {item.quantity} · {fmt(parseFloat(item.lineTotal.toString()))}</p>
                        </div>
                      </div>
                    );
                  })}

                  {/* Artwork & Buyer Details */}
                  <div className={styles.detailsRow}>
                    <div className={styles.buyerInfo}>
                      <h4>Delivery Destination</h4>
                      <p>
                        <strong>{order.address.fullName}</strong>
                      </p>
                      <p>{order.address.line1}</p>
                      {order.address.line2 && <p>{order.address.line2}</p>}
                      <p>
                        {order.address.city}, {order.address.state} — {order.address.postalCode}
                      </p>
                      <p className={styles.phone}>Phone: {order.address.phone}</p>
                    </div>

                    <div className={styles.financialInfo}>
                      <h4>Financial Split</h4>
                      <dl className={styles.dl}>
                        <div>
                          <dt>Gross Sale</dt>
                          <dd>₹{lineTotal.toLocaleString("en-IN")}</dd>
                        </div>
                        <div>
                          <dt>Platform Fee</dt>
                          <dd>-₹{commission.toLocaleString("en-IN")}</dd>
                        </div>
                        <div className={styles.netRow}>
                          <dt>Net Payout</dt>
                          <dd>₹{creatorNet.toLocaleString("en-IN")}</dd>
                        </div>
                      </dl>
                    </div>
                  </div>

                  {/* Status & Fulfillment Controller */}
                  <div className={styles.fulfillmentSection}>
                    <h4>Fulfillment Status</h4>
                    {!isPaid ? (
                      <p style={{ fontSize: 13, color: "#8a6d1b", background: "#fdf6e3", border: "1px solid #e8d9a8", borderRadius: 8, padding: "10px 14px" }}>
                        Awaiting buyer payment — this order will unlock for
                        fulfilment once payment is confirmed. Do not dispatch yet.
                      </p>
                    ) : (
                      <>
                        <OrderStatusUpdater
                          orderId={order.id}
                          currentStatus={order.status}
                        />
                        {/* Phase 2: Shiprocket auto-dispatch state */}
                        <div style={{ marginTop: 12 }}>
                          <h4 style={{ marginBottom: 6 }}>Courier Dispatch</h4>
                          {order.shipments.length === 0 ? (
                            <div>
                              <p style={{ fontSize: 13, color: "#6b5d4f" }}>
                                No courier shipment yet — dispatch manually below,
                                or retry auto-dispatch.
                              </p>
                              <div style={{ marginTop: 6 }}>
                                <RetryShipmentButton orderId={order.id} />
                              </div>
                            </div>
                          ) : (
                            order.shipments.map((s) => (
                              <div
                                key={s.id}
                                style={{
                                  fontSize: 13,
                                  color: "#5a4632",
                                  marginBottom: 8,
                                }}
                              >
                                {s.awbCode ? (
                                  <p>
                                    <strong>{s.carrier || "Courier"}</strong> — AWB{" "}
                                    <code>{s.awbCode}</code>
                                    {s.pickupLocation
                                      ? ` · via ${s.pickupLocation}`
                                      : ""}
                                  </p>
                                ) : (
                                  <div>
                                    <p style={{ color: "#a33" }}>
                                      Auto-dispatch pending
                                      {s.shipmentError
                                        ? `: ${s.shipmentError}`
                                        : ""}
                                      .
                                    </p>
                                    <div style={{ marginTop: 6 }}>
                                      <RetryShipmentButton orderId={order.id} />
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
            });
          })()}
        </div>
      )}
    </div>
  );
}
