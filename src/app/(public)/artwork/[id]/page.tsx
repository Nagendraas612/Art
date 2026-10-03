import Image from "next/image";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Nav } from "@/components/Nav";
import { ArtworkCard } from "@/components/ui/ArtworkCard";
import { ShareButtons } from "@/components/ui/ShareButtons";
import Link from "next/link";
import styles from "./artwork.module.css";
import { ArtworkProductType, ArtworkStatus, StockStatus } from "@prisma/client";
import { AddToCartCTA } from "@/components/ui/AddToCartCTA";
import { ArtworkGallery } from "@/components/artwork/ArtworkGallery";

import { ReviewsSection } from "@/components/ui/ReviewsSection";

export const revalidate = 3600;

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
      creator: { include: { user: { select: { id: true, name: true, image: true } } } },
      images: { orderBy: { sortOrder: "asc" }, take: 1 },
    },
  });

  if (!artwork) return { title: "Piece Not Found" };

  const firstImg = artwork.images[0]?.url;

  return {
    title: `${artwork.title} — ${artwork.creator.user.name}`,
    description: artwork.description.substring(0, 160),
    alternates: {
      canonical: `https://kalaabhadra.vercel.app/artwork/${artwork.slug || artwork.id}`,
    },
    openGraph: {
      title: `${artwork.title} by ${artwork.creator.user.name}`,
      description: artwork.description.substring(0, 160),
      ...(firstImg && { images: [{ url: firstImg }] }),
    },
    twitter: {
      card: "summary_large_image",
      title: `${artwork.title} by ${artwork.creator.user.name}`,
      description: artwork.description.substring(0, 160),
      ...(firstImg && { images: [firstImg] }),
    },
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
          user: { select: { id: true, name: true, image: true } },
        },
      },
      category: true,
      reviews: {
        where: { isHidden: false },
        include: {
          author: { select: { id: true, name: true, image: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!artwork) {
    notFound();
  }

  const relatedArtworks = await prisma.artwork.findMany({
    where: {
      status: ArtworkStatus.PUBLISHED,
      id: { not: artwork.id },
      OR: [
        { categoryId: artwork.categoryId },
        { creatorId: artwork.creatorId },
      ],
    },
    take: 3,
    include: {
      images: { orderBy: { sortOrder: "asc" }, take: 1 },
      creator: { include: { user: { select: { id: true, name: true, image: true } } } },
    },
  });

  const numPrice = typeof artwork.price === "number" ? artwork.price : parseFloat(artwork.price.toString());
  const formattedPrice = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: artwork.currency,
    maximumFractionDigits: 0,
  }).format(numPrice);

  const specs = (artwork.specifications as Record<string, any>) || {};

  const mainImage = artwork.images[0]?.url || "";
  const detailImages = artwork.images.slice(1);
  const isAvailable = artwork.stockStatus === StockStatus.AVAILABLE;
  const dispatchDays = artwork.processingDays || 3;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": artwork.title,
    "image": artwork.images.map((img) => img.url),
    "description": artwork.description,
    "sku": artwork.id,
    "brand": {
      "@type": "Brand",
      "name": artwork.creator.storeName,
    },
    "creator": {
      "@type": "Person",
      "name": artwork.creator.user.name,
    },
    "offers": {
      "@type": "Offer",
      "url": `https://kalaabhadra.vercel.app/artwork/${artwork.slug || artwork.id}`,
      "priceCurrency": artwork.currency,
      "price": artwork.price.toString(),
      "availability": isAvailable ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      "seller": {
        "@type": "Organization",
        "name": "Kalaa Bhadra",
      },
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          // Escape `<` so a creator-supplied `</script>` in a title/description
          // can never break out of this block (stored XSS, P8).
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
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
            {/* Gallery Column — client component so thumbnails switch the main image */}
            <ArtworkGallery
              mainImage={mainImage || null}
              mainAlt={artwork.images[0]?.altText || artwork.title}
              detailImages={detailImages}
              isOriginal={artwork.productType === ArtworkProductType.ORIGINAL}
            />

            {/* Product Info Column */}
            <div className={styles.infoCol}>
              {/* Creator Attribution */}
              <div className={styles.creatorAttribution}>
                <Link href={`/creators/${artwork.creator.handle}`} className={styles.creatorLink}>
                  {artwork.creator.profileImageUrl || artwork.creator.user.image ? (
                    <Image
                      src={artwork.creator.profileImageUrl || artwork.creator.user.image!}
                      alt={artwork.creator.user.name}
                      width={40}
                      height={40}
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
                    <dd>Ships in {dispatchDays} business day{dispatchDays === 1 ? "" : "s"} directly from creator studio</dd>
                  </div>
                </dl>
              </div>

              {/* Creator Studio Card */}
              <div className={styles.creatorCard}>
                <div className={styles.creatorCardHeader}>
                  <div className={styles.creatorCardAvatar}>
                    {artwork.creator.profileImageUrl || artwork.creator.user.image ? (
                      <Image
                        src={artwork.creator.profileImageUrl || artwork.creator.user.image!}
                        alt={artwork.creator.user.name}
                        width={48}
                        height={48}
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

              {/* Share Buttons */}
              <ShareButtons title={artwork.title} />
            </div>
          </div>

          {/* Related Artworks */}
          {relatedArtworks.length > 0 && (
            <section style={{ marginTop: "64px", paddingTop: "48px", borderTop: "1px solid var(--paper-deep)" }}>
              <div style={{ marginBottom: "24px" }}>
                <span style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--moss)", fontWeight: 600 }}>
                  Curated Collection
                </span>
                <h3 style={{ fontFamily: "var(--serif)", fontSize: "28px", margin: "4px 0 0 0", fontWeight: 400 }}>
                  You May Also Like
                </h3>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "24px" }}>
                {relatedArtworks.map((item) => (
                  <ArtworkCard
                    key={item.id}
                    id={item.id}
                    slug={item.slug}
                    title={item.title}
                    price={item.price.toString()}
                    currency={item.currency}
                    productType={item.productType}
                    imageUrl={item.images[0]?.url}
                    imageAlt={item.images[0]?.altText || item.title}
                    creator={{
                      name: item.creator.user.name,
                      handle: item.creator.handle,
                      avatarUrl: item.creator.profileImageUrl || item.creator.user.image,
                    }}
                    isSigned={item.isSigned}
                    hasCertificate={item.hasCertificate}
                    editionSize={item.editionSize}
                    editionSold={item.editionSold}
                  />
                ))}
              </div>
            </section>
          )}

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
