import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentCreator } from "@/lib/studio-auth";
import { ArtworkStatus, StockStatus } from "@prisma/client";
import styles from "./overview.module.css";

export default async function StudioOverviewPage() {
  const creator = await getCurrentCreator();

  if (!creator) {
    return (
      <div className={styles.emptyState}>
        <h2>No Creator Studio Found</h2>
        <p>Please register your studio to access the artisan workspace.</p>
        <Link href="/become-a-creator" className={styles.btnPrimary}>
          Apply as a Creator &rarr;
        </Link>
      </div>
    );
  }

  // Fetch creator metrics
  const artworks = await prisma.artwork.findMany({
    where: { creatorId: creator.id },
    include: {
      images: { orderBy: { sortOrder: "asc" }, take: 1 },
      category: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const earnings = await prisma.creatorEarning.findMany({
    where: { creatorId: creator.id },
  });

  const orderItems = await prisma.orderItem.findMany({
    where: { creatorId: creator.id },
    include: {
      order: {
        include: { address: true, payment: true },
      },
      artwork: true,
    },
    orderBy: { order: { createdAt: "desc" } },
    take: 5,
  });

  const totalEarningsNum = earnings.reduce(
    (acc, curr) => acc + parseFloat(curr.amount.toString()),
    0
  );

  const formattedTotalEarnings = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(totalEarningsNum);

  const totalViews = artworks.reduce((acc, curr) => acc + curr.viewCount, 0);
  const activePieces = artworks.filter((a) => a.status === ArtworkStatus.PUBLISHED).length;
  const soldOutPieces = artworks.filter((a) => a.stockStatus === StockStatus.SOLD || a.stock <= 0).length;

  return (
    <div className={styles.overview}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div>
          <span className={styles.greeting}>Studio Dashboard</span>
          <h1 className={styles.title}>{creator.storeName}</h1>
          <p className={styles.subtitle}>
            Manage your crafted pieces, inventory, logistics, and studio revenue.
          </p>
        </div>

        <div className={styles.headerActions}>
          <Link href="/studio/artworks/new" className={styles.createBtn}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>List New Piece</span>
          </Link>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className={styles.metricsGrid}>
        <div className={styles.metricCard}>
          <div className={styles.metricHead}>
            <span className={styles.metricLabel}>Net Studio Sales</span>
            <span className={styles.metricIcon}>₹</span>
          </div>
          <div className={styles.metricValue}>{formattedTotalEarnings}</div>
          <div className={styles.metricSub}>90% artisan payout after 10% platform fee</div>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricHead}>
            <span className={styles.metricLabel}>Active Catalog</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </div>
          <div className={styles.metricValue}>{activePieces} Works</div>
          <div className={styles.metricSub}>{soldOutPieces} works acquired / sold out</div>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricHead}>
            <span className={styles.metricLabel}>Studio Orders</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
          </div>
          <div className={styles.metricValue}>{earnings.length} Received</div>
          <div className={styles.metricSub}>
            <Link href="/studio/orders" className={styles.inlineLink}>
              View fulfillment queue &rarr;
            </Link>
          </div>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricHead}>
            <span className={styles.metricLabel}>Collector Views</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </div>
          <div className={styles.metricValue}>{totalViews} Views</div>
          <div className={styles.metricSub}>Across all listed portfolio items</div>
        </div>
      </div>

      {/* Two Column Layout for Recent Sales and Top Artworks */}
      <div className={styles.twoCol}>
        {/* Recent Studio Orders */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Recent Orders</h2>
            <Link href="/studio/orders" className={styles.cardActionLink}>
              View All &rarr;
            </Link>
          </div>

          {orderItems.length === 0 ? (
            <div className={styles.emptyCard}>
              <p>No orders received yet. New collector purchases will appear here.</p>
            </div>
          ) : (
            <div className={styles.orderList}>
              {orderItems.map((item) => {
                const lineTotal = parseFloat(item.lineTotal.toString());
                const creatorNet = parseFloat(item.creatorAmount.toString());

                return (
                  <div key={item.id} className={styles.orderItem}>
                    <div>
                      <h4 className={styles.orderItemTitle}>{item.titleSnapshot}</h4>
                      <p className={styles.orderMeta}>
                        Ref: {item.order.orderNumber} &bull; Buyer: {item.order.address.fullName} ({item.order.address.city})
                      </p>
                    </div>
                    <div className={styles.orderAmountCol}>
                      <span className={styles.orderPrice}>
                        {new Intl.NumberFormat("en-IN", {
                          style: "currency",
                          currency: "INR",
                          maximumFractionDigits: 0,
                        }).format(lineTotal)}
                      </span>
                      <span className={styles.netTag}>
                        Net: ₹{creatorNet.toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Featured Studio Artworks */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Studio Catalog ({artworks.length})</h2>
            <Link href="/studio/artworks" className={styles.cardActionLink}>
              Manage All &rarr;
            </Link>
          </div>

          <div className={styles.artList}>
            {artworks.slice(0, 5).map((art) => {
              const imgUrl = art.images[0]?.url || "";
              const priceNum = parseFloat(art.price.toString());
              const isSold = art.stockStatus === StockStatus.SOLD || art.stock <= 0;

              return (
                <div key={art.id} className={styles.artRow}>
                  <div className={styles.artThumb}>
                    {imgUrl ? <img src={imgUrl} alt={art.title} /> : <span>No img</span>}
                  </div>
                  <div className={styles.artMeta}>
                    <h4 className={styles.artTitle}>{art.title}</h4>
                    <span className={styles.artCategory}>{art.category.name}</span>
                  </div>
                  <div className={styles.artEnd}>
                    <span className={styles.artPrice}>
                      {new Intl.NumberFormat("en-IN", {
                        style: "currency",
                        currency: "INR",
                        maximumFractionDigits: 0,
                      }).format(priceNum)}
                    </span>
                    <span className={isSold ? styles.soldBadge : styles.availBadge}>
                      {isSold ? "Sold Out" : `In Stock (${art.stock})`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
