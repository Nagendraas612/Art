import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/modules/auth/guards";
import { Nav } from "@/components/Nav";
import { RetryPaymentButton } from "@/components/checkout/RetryPaymentButton";
import { OrderStatus, PaymentStatus, ShipmentStatus } from "@prisma/client";
import { SHIPMENT_STATUS_LABELS } from "@/lib/shipments";
import styles from "./order.module.css";

interface OrderConfirmationPageProps {
  params: Promise<{
    orderNumber: string;
  }>;
  searchParams: Promise<{
    t?: string;
  }>;
}

export async function generateMetadata({ params }: OrderConfirmationPageProps) {
  const { orderNumber } = await params;
  return {
    title: `Order ${orderNumber} — Kalaa Bhadra`,
    description: `Receipt and fulfillment tracking for order ${orderNumber}`,
  };
}

export default async function OrderConfirmationPage({ params, searchParams }: OrderConfirmationPageProps) {
  const { orderNumber } = await params;
  const { t: guestToken } = await searchParams;

  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: {
      address: true,
      payment: true,
      customer: { select: { email: true, id: true } },
      items: {
        include: {
          artwork: {
            include: {
              images: { orderBy: { sortOrder: "asc" } },
            },
          },
          creator: {
            // Only the id is needed (owning-creator check below); never pull
            // the full user row here.
            include: { user: { select: { id: true } } },
          },
        },
      },
      statusHistory: {
        orderBy: { createdAt: "desc" },
      },
      // Phase 2: show the auto-dispatched courier/AWB on the timeline.
      // Phase 3: also show the live shipment status from tracking webhooks.
      shipments: {
        where: { awbCode: { not: null } },
        select: { carrier: true, awbCode: true, status: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!order) {
    notFound();
  }

  // Ownership check: order pages render full name, address and phone, so
  // they are private to the ordering customer (signed in), an owning
  // creator, or an admin. Guests prove ownership with the unguessable
  // per-order token issued at checkout (?t=...), delivered only to the
  // buyer's email. The order number alone grants nothing.
  const session = await getSession();
  const viewerId = session?.user?.id;
  const viewerEmail = session?.user?.email;
  const viewerRole = session?.user?.role;

  const isOwner =
    (!!viewerId && viewerId === order.customerId) ||
    (!!viewerEmail && viewerEmail.toLowerCase() === order.customer.email.toLowerCase());
  const isAdmin = viewerRole === "ADMIN" || viewerRole === "SUPER_ADMIN";
  const isOwningCreator =
    !!viewerId &&
    order.items.some((item) => item.creator?.user?.id === viewerId);

  const hasGuestToken =
    typeof guestToken === "string" &&
    guestToken.length > 0 &&
    !!order.guestAccessToken &&
    guestToken === order.guestAccessToken;

  if (!isOwner && !isAdmin && !isOwningCreator && !hasGuestToken) {
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

  // Timeline states are driven by the real shipment data, not by order
  // status alone — a buyer whose courier delivered the parcel must not see
  // "preparation" as the current step.
  const shipments = order.shipments;
  const isPrepDone =
    shipments.length > 0 ||
    [OrderStatus.PACKED, OrderStatus.SHIPPED, OrderStatus.OUT_FOR_DELIVERY, OrderStatus.DELIVERED].includes(
      order.status
    );
  const isDispatched = shipments.length > 0;
  const isShipmentDelivered = shipments.some((s) => s.status === ShipmentStatus.DELIVERED);
  const isDelivered = order.status === OrderStatus.DELIVERED;

  // P8: never show "Confirmed" copy for an unpaid order. The studio only
  // starts work after payment clears.
  const isPaid = order.payment?.status === PaymentStatus.PAID;

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
            <h1 className={styles.heading}>{isPaid ? "Order Confirmed" : "Order Received"}</h1>
            <p className={styles.subheading}>
              {isPaid
                ? "Thank you for supporting independent artisans. Your order has been registered with the creators\u2019 studios."
                : "Your order is registered, but payment hasn't cleared yet. The studio starts work only after payment is confirmed — please complete your payment."}
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
                  <div className={`${styles.timelineStep} ${isPaid ? styles.stepDone : styles.stepActive}`}>
                    <div className={styles.stepDot}>{isPaid ? "\u2713" : "!"}</div>
                    <div className={styles.stepContent}>
                      <h4>{isPaid ? "Payment & Order Confirmed" : "Awaiting Payment"}</h4>
                      <p>{isPaid ? orderDate : "Complete your payment to confirm this order"}</p>
                    </div>
                  </div>

                  <div className={`${styles.timelineStep} ${isPrepDone ? styles.stepDone : isConfirmed ? styles.stepActive : ""}`}>
                    <div className={styles.stepDot}>{isPrepDone ? "\u2713" : "2"}</div>
                    <div className={styles.stepContent}>
                      <h4>Studio Preparation &amp; Authentication</h4>
                      <p>Artisan carefully inspecting, packaging, and stamping authenticity certificates</p>
                    </div>
                  </div>

                  <div className={`${styles.timelineStep} ${isShipmentDelivered ? styles.stepDone : isDispatched ? styles.stepActive : ""}`}>
                    <div className={styles.stepDot}>{isShipmentDelivered ? "\u2713" : "3"}</div>
                    <div className={styles.stepContent}>
                      <h4>Insured Logistics Dispatch</h4>
                      {isDispatched ? (
                        <div>
                          {shipments.map((s) => (
                            <p key={s.id}>
                              {SHIPMENT_STATUS_LABELS[s.status] || "Handed to courier"}
                              {" "}via {s.carrier || "courier"}
                              {s.awbCode ? (
                                <>
                                  {" "}— tracking <strong>{s.awbCode}</strong>
                                </>
                              ) : null}
                            </p>
                          ))}
                        </div>
                      ) : (
                        <p>Direct tracked shipping with temperature-controlled art care</p>
                      )}
                    </div>
                  </div>

                  <div className={`${styles.timelineStep} ${isDelivered ? styles.stepDone : ""}`}>
                    <div className={styles.stepDot}>{isDelivered ? "\u2713" : "4"}</div>
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
                {!isPaid && <RetryPaymentButton orderNumber={order.orderNumber} guestToken={typeof guestToken === "string" ? guestToken : undefined} />}
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
