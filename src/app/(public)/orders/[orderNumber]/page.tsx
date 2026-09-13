import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Nav } from "@/components/Nav";
import { OrderStatus } from "@prisma/client";
import styles from "./order.module.css";

interface OrderConfirmationPageProps {
  params: Promise<{
    orderNumber: string;
  }>;
}

export async function generateMetadata({ params }: OrderConfirmationPageProps) {
  const { orderNumber } = await params;
  return {
    title: `Order ${orderNumber} Confirmed — Atelier & Co.`,
    description: `Receipt and fulfillment tracking for order ${orderNumber}`,
  };
}

export default async function OrderConfirmationPage({ params }: OrderConfirmationPageProps) {
  const { orderNumber } = await params;

  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: {
      address: true,
      payment: true,
      items: {
        include: {
          artwork: {
            include: {
              images: { orderBy: { sortOrder: "asc" } },
            },
          },
          creator: {
            include: { user: true },
          },
        },
      },
      statusHistory: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!order) {
    notFound();
  }

  const formattedGrandTotal = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: order.currency,
    maximumFractionDigits: 0,
  }).format(parseFloat(order.grandTotal.toString()));

  const formattedSubtotal = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: order.currency,
    maximumFractionDigits: 0,
  }).format(parseFloat(order.subtotal.toString()));

  const shippingTotalNum = parseFloat(order.shippingTotal.toString());
  const formattedShipping = shippingTotalNum === 0 ? "Complimentary" : `₹${shippingTotalNum}`;

  const orderDate = new Intl.DateTimeFormat("en-IN", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(order.createdAt);

  const isConfirmed = order.status === OrderStatus.ORDER_CONFIRMED || order.status === OrderStatus.PREPARING;

  return (
    <>
      <Nav />
      <main className={styles.main}>
        <div className="wrap">
          {/* Header Banner */}
          <div className={styles.banner}>
            <div className={styles.successIcon}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h1 className={styles.heading}>Order Confirmed</h1>
            <p className={styles.subheading}>
              Thank you for supporting independent artisans. Your order has been registered with the creators&apos; studios.
            </p>
            <div className={styles.orderNumberBadge}>
              Order Ref: <strong>{order.orderNumber}</strong>
            </div>
          </div>

          <div className={styles.grid}>
            {/* Left Column: Items & Timeline */}
            <div className={styles.mainCol}>
              {/* Studio Fulfillment Timeline */}
              <div className={styles.card}>
                <h2 className={styles.cardTitle}>Fulfillment Timeline</h2>
                <div className={styles.timeline}>
                  <div className={`${styles.timelineStep} ${styles.stepDone}`}>
                    <div className={styles.stepDot}>✓</div>
                    <div className={styles.stepContent}>
                      <h4>Payment &amp; Order Confirmed</h4>
                      <p>{orderDate}</p>
                    </div>
                  </div>

                  <div className={`${styles.timelineStep} ${isConfirmed ? styles.stepActive : ""}`}>
                    <div className={styles.stepDot}>2</div>
                    <div className={styles.stepContent}>
                      <h4>Studio Preparation &amp; Authentication</h4>
                      <p>Artisan carefully inspecting, packaging, and stamping authenticity certificates</p>
                    </div>
                  </div>

                  <div className={styles.timelineStep}>
                    <div className={styles.stepDot}>3</div>
                    <div className={styles.stepContent}>
                      <h4>Insured Logistics Dispatch</h4>
                      <p>Direct tracked shipping with temperature-controlled art care</p>
                    </div>
                  </div>

                  <div className={styles.timelineStep}>
                    <div className={styles.stepDot}>4</div>
                    <div className={styles.stepContent}>
                      <h4>Delivered to Destination</h4>
                      <p>Hand-delivered with verification sign-off</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Purchased Works */}
              <div className={styles.card}>
                <h2 className={styles.cardTitle}>Acquired Artworks ({order.items.length})</h2>
                <div className={styles.itemsList}>
                  {order.items.map((item) => {
                    const imgUrl = item.artwork?.images[0]?.url || "";
                    const unitPriceNum = parseFloat(item.unitPrice.toString());
                    const lineTotalNum = parseFloat(item.lineTotal.toString());

                    return (
                      <div key={item.id} className={styles.itemRow}>
                        <div className={styles.itemImageWrap}>
                          {imgUrl ? (
                            <img src={imgUrl} alt={item.titleSnapshot} className={styles.itemImage} />
                          ) : (
                            <div className={styles.noImage}>No image</div>
                          )}
                        </div>

                        <div className={styles.itemDetails}>
                          <div className={styles.itemHead}>
                            <Link href={`/artwork/${item.artwork?.slug || item.artworkId}`} className={styles.itemTitle}>
                              {item.titleSnapshot}
                            </Link>
                            <span className={styles.itemPrice}>
                              {new Intl.NumberFormat("en-IN", {
                                style: "currency",
                                currency: order.currency,
                                maximumFractionDigits: 0,
                              }).format(lineTotalNum)}
                            </span>
                          </div>

                          <p className={styles.creatorAttribution}>
                            Created by{" "}
                            <Link href={`/creators/${item.creator.handle}`} className={styles.creatorLink}>
                              {item.creator.storeName}
                            </Link>
                          </p>

                          <div className={styles.itemFooter}>
                            <span className={styles.qtyTag}>Qty: {item.quantity}</span>
                            {item.quantity > 1 && (
                              <span className={styles.unitPriceTag}>
                                (
                                {new Intl.NumberFormat("en-IN", {
                                  style: "currency",
                                  currency: order.currency,
                                  maximumFractionDigits: 0,
                                }).format(unitPriceNum)}{" "}
                                each)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right Column: Destination & Financial Summary */}
            <div className={styles.sideCol}>
              {/* Delivery Address */}
              <div className={styles.card}>
                <h3 className={styles.sideCardTitle}>Delivery Destination</h3>
                <div className={styles.addressBlock}>
                  <strong>{order.address.fullName}</strong>
                  <p>{order.address.line1}</p>
                  {order.address.line2 && <p>{order.address.line2}</p>}
                  <p>
                    {order.address.city}, {order.address.state} — {order.address.postalCode}
                  </p>
                  <p>{order.address.country}</p>
                  <p className={styles.phoneRow}>Phone: {order.address.phone}</p>
                </div>
              </div>

              {/* Payment Receipt */}
              <div className={styles.card}>
                <h3 className={styles.sideCardTitle}>Payment Summary</h3>
                <dl className={styles.receiptBreakdown}>
                  <div className={styles.receiptRow}>
                    <dt>Subtotal</dt>
                    <dd>{formattedSubtotal}</dd>
                  </div>
                  <div className={styles.receiptRow}>
                    <dt>Insured Art Shipping</dt>
                    <dd className={shippingTotalNum === 0 ? styles.freeText : ""}>
                      {formattedShipping}
                    </dd>
                  </div>
                  <div className={styles.receiptRow}>
                    <dt>Payment Gateway</dt>
                    <dd>{order.payment?.gateway || "Secured"}</dd>
                  </div>
                  <div className={styles.receiptRow}>
                    <dt>Payment Status</dt>
                    <dd className={styles.paidStatus}>
                      {order.payment?.status === "PAID" ? "Paid & Verified" : "Pending Confirmation"}
                    </dd>
                  </div>
                  <div className={styles.receiptTotalRow}>
                    <dt>Grand Total</dt>
                    <dd>{formattedGrandTotal}</dd>
                  </div>
                </dl>
              </div>

              {/* Next Actions */}
              <div className={styles.actionCard}>
                <Link href="/explore" className={styles.exploreBtn}>
                  Explore More Artworks &rarr;
                </Link>
                <Link href="/creators" className={styles.secondaryBtn}>
                  Browse Creator Studios
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
