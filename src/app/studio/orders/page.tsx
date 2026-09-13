import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentCreator } from "@/lib/studio-auth";
import { OrderStatusUpdater } from "@/components/studio/OrderStatusUpdater";
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
          {orderItems.map((item) => {
            const lineTotal = parseFloat(item.lineTotal.toString());
            const creatorNet = parseFloat(item.creatorAmount.toString());
            const commission = parseFloat(item.platformCommission.toString());
            const imgUrl = item.artwork.images[0]?.url || "";

            const orderDate = new Intl.DateTimeFormat("en-IN", {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(item.order.createdAt);

            return (
              <div key={item.id} className={styles.orderCard}>
                <div className={styles.cardTop}>
                  <div>
                    <div className={styles.refRow}>
                      <span className={styles.orderRef}>{item.order.orderNumber}</span>
                      <span className={styles.orderDate}>{orderDate}</span>
                    </div>
                    <h3 className={styles.artTitle}>{item.titleSnapshot}</h3>
                  </div>

                  <div className={styles.priceMeta}>
                    <span className={styles.totalPrice}>
                      {new Intl.NumberFormat("en-IN", {
                        style: "currency",
                        currency: item.order.currency,
                        maximumFractionDigits: 0,
                      }).format(lineTotal)}
                    </span>
                    <span className={styles.netShare}>
                      Studio Net: ₹{creatorNet.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>

                <div className={styles.cardBody}>
                  {/* Artwork & Buyer Details */}
                  <div className={styles.detailsRow}>
                    <div className={styles.thumbWrap}>
                      {imgUrl ? <img src={imgUrl} alt={item.titleSnapshot} /> : null}
                    </div>

                    <div className={styles.buyerInfo}>
                      <h4>Delivery Destination</h4>
                      <p>
                        <strong>{item.order.address.fullName}</strong>
                      </p>
                      <p>{item.order.address.line1}</p>
                      {item.order.address.line2 && <p>{item.order.address.line2}</p>}
                      <p>
                        {item.order.address.city}, {item.order.address.state} — {item.order.address.postalCode}
                      </p>
                      <p className={styles.phone}>Phone: {item.order.address.phone}</p>
                    </div>

                    <div className={styles.financialInfo}>
                      <h4>Financial Split</h4>
                      <dl className={styles.dl}>
                        <div>
                          <dt>Gross Sale</dt>
                          <dd>₹{lineTotal.toLocaleString("en-IN")}</dd>
                        </div>
                        <div>
                          <dt>Platform Fee (10%)</dt>
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
                    <OrderStatusUpdater
                      orderId={item.order.id}
                      currentStatus={item.order.status}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
