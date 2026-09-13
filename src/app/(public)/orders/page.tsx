import Link from "next/link";
import Image from "next/image";
import { getCustomerOrdersAction } from "@/app/actions/checkout";
import styles from "./orders-history.module.css";
import { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My Orders | Atelier & Co.",
  description: "View and track your acquired art pieces, limited editions, and bespoke commissions.",
};

export default async function CustomerOrdersPage() {
  const res = await getCustomerOrdersAction();
  const orders = res.success && res.orders ? res.orders : [];

  const formatStatus = (status: string) => {
    switch (status) {
      case "ORDER_CONFIRMED":
        return { label: "Confirmed", className: styles.statusConfirmed };
      case "IN_PRODUCTION":
        return { label: "In Creation", className: styles.statusProcessing };
      case "DISPATCHED":
        return { label: "Dispatched", className: styles.statusDispatched };
      case "DELIVERED":
        return { label: "Delivered", className: styles.statusDelivered };
      case "CANCELLED":
        return { label: "Cancelled", className: styles.statusCancelled };
      default:
        return { label: status.replace(/_/g, " "), className: styles.statusProcessing };
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Your Acquisitions & Orders</h1>
        <p className={styles.subtitle}>
          Track original artworks, limited editions, and custom bespoke commissions crafted for you.
        </p>
      </header>

      {orders.length === 0 ? (
        <div className={styles.emptyState}>
          <svg
            className={styles.emptyIcon}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <path d="M16 10a4 4 0 0 1-8 0" />
          </svg>
          <h2 className={styles.emptyTitle}>No acquisitions yet</h2>
          <p className={styles.emptyText}>
            You haven't acquired any handcrafted pieces yet. Discover independent master artisans and rare collector items.
          </p>
          <Link href="/explore" className={styles.exploreBtn}>
            Explore Gallery
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </Link>
        </div>
      ) : (
        <div className={styles.orderList}>
          {orders.map((order) => {
            const statusInfo = formatStatus(order.status);
            return (
              <div key={order.id} className={styles.orderCard}>
                <div className={styles.orderHeader}>
                  <div className={styles.orderMetaGroup}>
                    <div className={styles.metaBlock}>
                      <span className={styles.metaLabel}>Order Placed</span>
                      <span className={styles.metaValue}>
                        {new Date(order.createdAt).toLocaleDateString("en-IN", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </div>

                    <div className={styles.metaBlock}>
                      <span className={styles.metaLabel}>Order Number</span>
                      <span className={styles.metaValue}>#{order.orderNumber}</span>
                    </div>

                    <div className={styles.metaBlock}>
                      <span className={styles.metaLabel}>Total</span>
                      <span className={styles.metaValue}>
                        ₹{order.grandTotal.toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>

                  <div className={styles.orderActions}>
                    <span className={`${styles.statusPill} ${statusInfo.className}`}>
                      {statusInfo.label}
                    </span>
                    <Link
                      href={`/orders/${order.orderNumber}`}
                      className={styles.viewDetailsLink}
                    >
                      Track Order →
                    </Link>
                  </div>
                </div>

                <div className={styles.orderItems}>
                  {order.items.map((item) => (
                    <div key={item.id} className={styles.itemRow}>
                      {item.imageUrl ? (
                        <Image
                          src={item.imageUrl}
                          alt={item.title}
                          width={64}
                          height={64}
                          className={styles.itemThumb}
                        />
                      ) : (
                        <div className={styles.itemThumb} />
                      )}

                      <div className={styles.itemDetails}>
                        <div className={styles.itemTitle}>{item.title}</div>
                        <div className={styles.itemCreator}>
                          By {item.creatorName} · Qty: {item.quantity}
                        </div>
                      </div>

                      <div className={styles.itemPrice}>
                        ₹{item.lineTotal.toLocaleString("en-IN")}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
