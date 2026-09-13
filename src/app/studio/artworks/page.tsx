import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentCreator } from "@/lib/studio-auth";
import { ArtworkStatus, StockStatus, ArtworkProductType } from "@prisma/client";
import styles from "./artworks.module.css";

export default async function StudioArtworksPage() {
  const creator = await getCurrentCreator();

  if (!creator) {
    return <div className={styles.empty}>Studio not found.</div>;
  }

  const artworks = await prisma.artwork.findMany({
    where: { creatorId: creator.id },
    include: {
      category: true,
      images: { orderBy: { sortOrder: "asc" }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Artworks &amp; Inventory</h1>
          <p className={styles.subtitle}>
            Manage your crafted pieces, stock allocations, craft specifications, and public visibility.
          </p>
        </div>

        <Link href="/studio/artworks/new" className={styles.createBtn}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>List New Piece</span>
        </Link>
      </div>

      {artworks.length === 0 ? (
        <div className={styles.emptyCard}>
          <h2>No Artworks Listed Yet</h2>
          <p>Your studio catalog is currently empty. List your first original or handcrafted edition.</p>
          <Link href="/studio/artworks/new" className={styles.createBtn}>
            List Your First Artwork &rarr;
          </Link>
        </div>
      ) : (
        <div className={styles.tableCard}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Artwork</th>
                <th>Category</th>
                <th>Type</th>
                <th>Price</th>
                <th>Inventory</th>
                <th>Status</th>
                <th className={styles.actionsHeader}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {artworks.map((art) => {
                const imgUrl = art.images[0]?.url || "";
                const priceNum = parseFloat(art.price.toString());
                const isSold = art.stockStatus === StockStatus.SOLD || art.stock <= 0;

                return (
                  <tr key={art.id} className={styles.tr}>
                    <td>
                      <div className={styles.artCell}>
                        <div className={styles.thumbWrap}>
                          {imgUrl ? <img src={imgUrl} alt={art.title} className={styles.thumb} /> : <div className={styles.noThumb} />}
                        </div>
                        <div className={styles.artText}>
                          <span className={styles.artTitle}>{art.title}</span>
                          <span className={styles.artSlug}>/{art.slug}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={styles.categoryBadge}>{art.category.name}</span>
                    </td>
                    <td>
                      {art.productType === ArtworkProductType.ORIGINAL ? (
                        <span className={styles.originalTag}>1/1 Original</span>
                      ) : art.productType === ArtworkProductType.LIMITED_EDITION ? (
                        <span className={styles.limitedTag}>Limited Edition</span>
                      ) : (
                        <span className={styles.editionTag}>{art.productType}</span>
                      )}
                    </td>
                    <td className={styles.priceCell}>
                      {new Intl.NumberFormat("en-IN", {
                        style: "currency",
                        currency: art.currency,
                        maximumFractionDigits: 0,
                      }).format(priceNum)}
                    </td>
                    <td>
                      {isSold ? (
                        <span className={styles.soldTag}>Sold Out</span>
                      ) : (
                        <span className={styles.inStockTag}>
                          {art.stock} {art.stock === 1 ? "unit" : "units"}
                        </span>
                      )}
                    </td>
                    <td>
                      <span
                        className={`${styles.statusBadge} ${
                          art.status === ArtworkStatus.PUBLISHED
                            ? styles.statusPublished
                            : styles.statusDraft
                        }`}
                      >
                        {art.status}
                      </span>
                    </td>
                    <td>
                      <div className={styles.actionsCell}>
                        <Link href={`/artwork/${art.slug}`} target="_blank" className={styles.actionBtn}>
                          Live ↗
                        </Link>
                        <Link href={`/studio/artworks/${art.id}/edit`} className={styles.editBtn}>
                          Edit
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
