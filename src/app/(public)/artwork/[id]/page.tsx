import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Nav } from "@/components/Nav";
import Link from "next/link";
import styles from "./artwork.module.css";
import { ArtworkProductType, ArtworkStatus, StockStatus } from "@prisma/client";
import { AddToCartCTA } from "@/components/ui/AddToCartCTA";

import { ReviewsSection } from "@/components/ui/ReviewsSection";

interface ArtworkDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export async function generateMetadata({ params }: ArtworkDetailPageProps) {
  const { id } = await params;
  const artwork = await prisma.artwork.findFirst({
    where: {
      OR: [{ slug: id }, { id: id }],
      status: ArtworkStatus.PUBLISHED,
    },
    include: {
      creator: { include: { user: true } },
    },
  });

  if (!artwork) return { title: "Piece Not Found" };

  return {
    title: `${artwork.title} — ${artwork.creator.user.name} | Atelier & Co.`,
    description: artwork.description.substring(0, 160),
  };
}

export default async function ArtworkDetailPage({ params }: ArtworkDetailPageProps) {
  const { id } = await params;

  const artwork = await prisma.artwork.findFirst({
    where: {
      OR: [{ slug: id }, { id: id }],
      status: ArtworkStatus.PUBLISHED,
    },
    include: {
      images: {
        orderBy: { sortOrder: "asc" },
      },
      creator: {
        include: {
          user: true,
        },
      },
      category: true,
      reviews: {
        where: { isHidden: false },
        include: {
          author: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!artwork) {
    notFound();
  }

  const numPrice = typeof artwork.price === "number" ? artwork.price : parseFloat(artwork.price.toString());
  const formattedPrice = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: artwork.currency,
    maximumFractionDigits: 0,
  }).format(numPrice);

  const specs = (artwork.specifications as Record<string, any>) || {};

  const mainImage = artwork.images[0]?.url || "";
  const detailImages = artwork.images.slice(1);

  return (
    <>
      <Nav />
      <main className={styles.main}>
        <div className="wrap">
          {/* Breadcrumbs */}
          <nav className={styles.breadcrumb} aria-label="Breadcrumb">
            <Link href="/explore">Explore</Link>
            <span className={styles.crumbDivider}>/</span>
            <Link href={`/explore?category=${artwork.category.slug}`}>{artwork.category.name}</Link>
            <span className={styles.crumbDivider}>/</span>
            <span className={styles.crumbCurrent}>{artwork.title}</span>
          </nav>

          <div className={styles.layout}>
            {/* Gallery Column */}
            <div className={styles.galleryCol}>
              <div className={styles.mainImageWrap}>
                {mainImage ? (
                  <img
                    src={mainImage}
                    alt={artwork.images[0]?.altText || artwork.title}
                    className={styles.mainImage}
                  />
                ) : (
                  <div className={styles.placeholderImage}>No image available</div>
                )}
                {artwork.productType === ArtworkProductType.ORIGINAL && (
                  <span className={styles.badgeFloating}>Unique 1/1 Original</span>
                )}
              </div>

              {detailImages.length > 0 && (
                <div className={styles.detailGrid}>
                  {detailImages.map((img, idx) => (
                    <div key={img.id || idx} className={styles.detailImageWrap}>
                      <img src={img.url} alt={img.altText || `Detail ${idx + 1}`} className={styles.detailImage} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Product Info Column */}
            <div className={styles.infoCol}>
              {/* Creator Attribution */}
              <div className={styles.creatorAttribution}>
                <Link href={`/creators/${artwork.creator.handle}`} className={styles.creatorLink}>
                  {artwork.creator.profileImageUrl || artwork.creator.user.image ? (
                    <img
                      src={artwork.creator.profileImageUrl || artwork.creator.user.image!}
                      alt={artwork.creator.user.name}
                      className={styles.creatorAvatar}
                    />
                  ) : null}
                  <div>
                    <span className={styles.creatorName}>{artwork.creator.user.name}</span>
                    <span className={styles.creatorStore}>{artwork.creator.storeName}</span>
                  </div>
                </Link>
              </div>

              <h1 className={styles.title}>{artwork.title}</h1>

              <div className={styles.priceRow}>
                <span className={styles.price}>{formattedPrice}</span>
                {artwork.stockStatus === StockStatus.AVAILABLE ? (
                  <span className={styles.inStockBadge}>In Studio • Available</span>
                ) : (
                  <span className={styles.outOfStockBadge}>Sold Out</span>
                )}
              </div>

              {artwork.productType === ArtworkProductType.LIMITED_EDITION && (
                <div className={styles.editionNotice}>
                  <strong>Limited Edition:</strong> {artwork.editionSold} of {artwork.editionSize} prints sold. Each print is numbered and hand-signed by the artist.
                </div>
              )}

              {/* Description */}
              <div className={styles.descriptionSection}>
                <h3 className={styles.sectionHeading}>About this Work</h3>
                <p className={styles.description}>{artwork.description}</p>
              </div>

              {/* Action CTAs */}
              <div className={styles.actions}>
                <AddToCartCTA
                  artwork={{
                    id: artwork.id,
                    title: artwork.title,
                    slug: artwork.slug,
                    price: numPrice,
                    currency: artwork.currency,
                    imageUrl: mainImage,
                    productType: artwork.productType,
                    stock: artwork.stock,
                    stockStatus: artwork.stockStatus,
                    creatorId: artwork.creator.id,
                    creatorName: artwork.creator.user.name,
                    creatorStore: artwork.creator.storeName,
                    creatorHandle: artwork.creator.handle,
                  }}
                />
              </div>

              {/* Specifications Table */}
              <div className={styles.specsSection}>
                <h3 className={styles.sectionHeading}>Artwork Specifications</h3>
                <dl className={styles.specsGrid}>
                  {specs.medium && (
                    <div className={styles.specItem}>
                      <dt>Medium</dt>
                      <dd>{specs.medium}</dd>
                    </div>
                  )}
                  {specs.surface && (
                    <div className={styles.specItem}>
                      <dt>Surface / Base</dt>
                      <dd>{specs.surface}</dd>
                    </div>
                  )}
                  {specs.clayBody && (
                    <div className={styles.specItem}>
                      <dt>Clay Body</dt>
                      <dd>{specs.clayBody}</dd>
                    </div>
                  )}
                  {specs.glaze && (
                    <div className={styles.specItem}>
                      <dt>Glaze &amp; Firing</dt>
                      <dd>{specs.glaze}</dd>
                    </div>
                  )}
                  {specs.fibers && (
                    <div className={styles.specItem}>
                      <dt>Fibers &amp; Dyes</dt>
                      <dd>{specs.fibers}</dd>
                    </div>
                  )}
                  {specs.timber && (
                    <div className={styles.specItem}>
                      <dt>Timber Species</dt>
                      <dd>{specs.timber}</dd>
                    </div>
                  )}
                  {specs.printingMethod && (
                    <div className={styles.specItem}>
                      <dt>Printing Method</dt>
                      <dd>{specs.printingMethod}</dd>
                    </div>
                  )}
                  {specs.paper && (
                    <div className={styles.specItem}>
                      <dt>Archival Paper</dt>
                      <dd>{specs.paper}</dd>
                    </div>
                  )}
                  {(artwork.widthCm != null || artwork.heightCm != null) && (
                    <div className={styles.specItem}>
                      <dt>Dimensions</dt>
                      <dd>
                        {artwork.heightCm ? artwork.heightCm.toString() : ""}{artwork.widthCm ? ` × ${artwork.widthCm.toString()}` : ""}
                        {artwork.depthCm ? ` × ${artwork.depthCm.toString()}` : ""} cm
                      </dd>
                    </div>
                  )}
                  {artwork.weightGrams && (
                    <div className={styles.specItem}>
                      <dt>Weight</dt>
                      <dd>{(artwork.weightGrams / 1000).toFixed(2)} kg</dd>
                    </div>
                  )}
                  <div className={styles.specItem}>
                    <dt>Authenticity</dt>
                    <dd>
                      {artwork.isSigned ? "Hand-signed by artist" : "Studio stamped"}
                      {artwork.hasCertificate ? " • Certificate of Authenticity included" : ""}
                    </dd>
                  </div>
                  <div className={styles.specItem}>
                    <dt>Dispatch Time</dt>
                    <dd>Ships in {artwork.processingDays || 3} business days directly from creator studio</dd>
                  </div>
                </dl>
              </div>

              {/* Creator Studio Card */}
              <div className={styles.creatorCard}>
                <div className={styles.creatorCardHeader}>
                  <div className={styles.creatorCardAvatar}>
                    {artwork.creator.profileImageUrl || artwork.creator.user.image ? (
                      <img
                        src={artwork.creator.profileImageUrl || artwork.creator.user.image!}
                        alt={artwork.creator.user.name}
                      />
                    ) : (
                      <span>{artwork.creator.storeName.charAt(0)}</span>
                    )}
                  </div>
                  <div>
                    <h4 className={styles.creatorCardTitle}>{artwork.creator.storeName}</h4>
                    <p className={styles.creatorCardHandle}>@{artwork.creator.handle}</p>
                  </div>
                </div>
                {artwork.creator.bio && <p className={styles.creatorCardBio}>{artwork.creator.bio}</p>}
                <Link href={`/creators/${artwork.creator.handle}`} className={styles.creatorCardLink}>
                  View full studio portfolio &rarr;
                </Link>
              </div>
            </div>
          </div>

          {/* Collector Reviews */}
          <ReviewsSection
            artworkId={artwork.id}
            initialReviews={artwork.reviews}
          />
        </div>
      </main>
    </>
  );
}
