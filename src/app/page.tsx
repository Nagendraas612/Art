import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/modules/auth/guards";
import { Nav } from "@/components/Nav";
import { ArtworkCard } from "@/components/ui/ArtworkCard";
import Link from "next/link";
import styles from "./page.module.css";
import { ArtworkStatus, CreatorStatus } from "@prisma/client";

export const revalidate = 3600;

export default async function Home() {
  const session = await getSession();

  // 1. Fetch statistics
  const [totalArtworks, totalCreators] = await Promise.all([
    prisma.artwork.count({ where: { status: ArtworkStatus.PUBLISHED } }),
    prisma.creatorProfile.count({ where: { status: CreatorStatus.APPROVED } }),
  ]);

  // 2. Fetch featured artworks
  const featuredArtworks = await prisma.artwork.findMany({
    where: { status: ArtworkStatus.PUBLISHED },
    orderBy: [{ publishedAt: "desc" }],
    take: 6,
    include: {
      images: { orderBy: { sortOrder: "asc" }, take: 1 },
      creator: { include: { user: { select: { id: true, name: true, image: true } } } },
      category: true,
    },
  });

  // 3. User wishlist IDs for hearts
  let userWishlistIds = new Set<string>();
  if (session?.user?.id) {
    const wishlistItems = await prisma.wishlistItem.findMany({
      where: { wishlist: { userId: session.user.id } },
      select: { artworkId: true },
    });
    userWishlistIds = new Set(wishlistItems.map((w) => w.artworkId));
  }

  // 4. Fetch active categories
  const categories = await prisma.artworkCategory.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    include: {
      _count: { select: { artworks: { where: { status: ArtworkStatus.PUBLISHED } } } },
    },
  });

  // 5. Fetch spotlight creators
  const featuredCreators = await prisma.creatorProfile.findMany({
    where: { status: CreatorStatus.APPROVED },
    take: 3,
    include: {
      // Narrow: only the fields the cards render. Never pull full User rows
      // (passwordHash) into page data.
      user: { select: { id: true, name: true, image: true } },
    },
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            "name": "Kalaa Bhadra",
            "url": "https://kalaabhadra.vercel.app",
            "logo": "https://kalaabhadra.vercel.app/KaalaBhadraLogoTransparent.png",
            "description": "Marketplace for original art and handmade craft, sold directly by independent artists across India.",
            "sameAs": [],
          }),
        }}
      />
      <Nav />
      <main>
        {/* Hero Section */}
        <section className={styles.hero}>
          <div className={`wrap ${styles.heroInner}`}>
            <div className={styles.heroCopy}>
              <span className={styles.kicker}>Fine Art &amp; Handcrafted Gallery</span>
              <h1 className={styles.headline}>
                Made by people.
                <br />
                Meant to be kept.
              </h1>
              <p className={styles.subline}>
                Original paintings, ceramics, textiles and prints — bought directly from the artists who made them.
              </p>
              <div className={styles.ctas}>
                <Link href="/explore" className={styles.btnPrimary}>
                  Explore Collection
                </Link>
                <Link href="/become-a-creator" className={styles.btnSecondary}>
                  Apply as Creator
                </Link>
              </div>
            </div>
            <div className={styles.heroLogo}>
              <Image
                src="/KaalaBhadraLogoTransparent.png"
                alt="Kalaa Bhadra Logo"
                width={280}
                height={280}
                priority
                className={styles.heroLogoImg}
              />
            </div>
          </div>

          <div className={`wrap ${styles.statsBar}`}>
            <div className={styles.statItem}>
              <span className={styles.statNum}>{totalArtworks}</span>
              <span className={styles.statLabel}>Original Works</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statNum}>{totalCreators}+</span>
              <span className={styles.statLabel}>Verified Artisans</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statNum}>100%</span>
              <span className={styles.statLabel}>Authentic</span>
            </div>
          </div>
        </section>

        {/* Categories Section */}
        {categories.length > 0 && (
          <section className={styles.section}>
            <div className="wrap">
              <div className={styles.sectionHeader}>
                <span className={styles.sectionBadge}>Curated Mediums</span>
                <h2 className={styles.sectionTitle}>Browse Archives</h2>
                <p className={styles.sectionSubtitle}>
                  Browse paintings, ceramics, prints and woodwork — organized by craft.
                </p>
              </div>

              <div className={styles.categoryGrid}>
                {categories
                  .filter((cat) => cat._count.artworks > 0)
                  .map((cat) => (
                  <Link
                    key={cat.id}
                    href={`/explore?category=${cat.slug}`}
                    className={styles.categoryCard}
                  >
                    <div>
                      <h3 className={styles.catName}>{cat.name}</h3>
                      <span className={styles.catCount}>
                        {cat._count.artworks} {cat._count.artworks === 1 ? "piece" : "pieces"}
                      </span>
                    </div>
                    <div className={styles.catArrow}>
                      Explore Archive &rarr;
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Featured Artworks Section */}
        {featuredArtworks.length > 0 && (
          <section className={styles.sectionAlt}>
            <div className="wrap">
              <div className={styles.sectionHeader}>
                <span className={styles.sectionBadge}>Acquisitions Spotlight</span>
                <h2 className={styles.sectionTitle}>Featured Artworks</h2>
                <p className={styles.sectionSubtitle}>
                  One-of-a-kind pieces, ready to buy today.
                </p>
              </div>

              <div className={styles.artworksGrid}>
                {featuredArtworks.map((art) => {
                  const mainImage = art.images[0]?.url;
                  const altText = art.images[0]?.altText || art.title;
                  const specs = art.specifications as Record<string, any> | null;
                  const medium = specs?.medium || specs?.clayBody || specs?.fibers || specs?.timber;

                  return (
                    <ArtworkCard
                      key={art.id}
                      id={art.id}
                      slug={art.slug}
                      title={art.title}
                      price={art.price.toString()}
                      currency={art.currency}
                      productType={art.productType}
                      imageUrl={mainImage}
                      imageAlt={altText}
                      creator={{
                        name: art.creator.user.name,
                        handle: art.creator.handle,
                        avatarUrl: art.creator.profileImageUrl || art.creator.user.image,
                      }}
                      medium={medium}
                      isSigned={art.isSigned}
                      hasCertificate={art.hasCertificate}
                      editionSize={art.editionSize}
                      editionSold={art.editionSold}
                      isWishlisted={userWishlistIds.has(art.id)}
                    />
                  );
                })}
              </div>

              <div className={styles.viewAllWrap}>
                <Link href="/explore" className={styles.btnPrimary}>
                  View Full Gallery Archive ({totalArtworks} Pieces) &rarr;
                </Link>
              </div>
            </div>
          </section>
        )}

        {/* Featured Creators Section */}
        {featuredCreators.length > 0 && (
          <section className={styles.section}>
            <div className="wrap">
              <div className={styles.sectionHeader}>
                <span className={styles.sectionBadge}>Master Artisans</span>
                <h2 className={styles.sectionTitle}>Meet the Creators</h2>
                <p className={styles.sectionSubtitle}>
                  Meet the artists behind the work — and buy pieces made to last.
                </p>
              </div>

              <div className={styles.creatorsGrid}>
                {featuredCreators.map((creator) => (
                  <Link
                    key={creator.id}
                    href={`/creators/${creator.handle}`}
                    className={styles.creatorCard}
                  >
                    <div className={styles.creatorHeader}>
                      {creator.profileImageUrl || creator.user.image ? (
                        <Image
                          src={creator.profileImageUrl || creator.user.image!}
                          alt={creator.user.name}
                          width={48}
                          height={48}
                          className={styles.creatorAvatar}
                        />
                      ) : (
                        <div className={styles.creatorAvatar}>
                          {creator.user.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className={styles.creatorInfo}>
                        <span className={styles.creatorName}>{creator.user.name}</span>
                        <span className={styles.creatorStore}>{creator.storeName}</span>
                      </div>
                    </div>
                    {creator.bio && <p className={styles.creatorBio}>{creator.bio}</p>}
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Value Props & Guarantee */}
        <section className={styles.sectionAlt}>
          <div className="wrap">
            <div className={styles.propsGrid}>
              <div className={styles.propCard}>
                <span className={styles.propIcon}>🏛️</span>
                <h3 className={styles.propTitle}>Certified Authentic</h3>
                <p className={styles.propDesc}>
                  Every physical artwork includes a signed Certificate of Authenticity directly from the artist.
                </p>
              </div>
              <div className={styles.propCard}>
                <span className={styles.propIcon}>🤝</span>
                <h3 className={styles.propTitle}>Direct Artist Support</h3>
                <p className={styles.propDesc}>
                  90% of every sale goes directly to the artist — our 10% keeps the platform running.
                </p>
              </div>
              <div className={styles.propCard}>
                <span className={styles.propIcon}>📦</span>
                <h3 className={styles.propTitle}>Insured Shipping</h3>
                <p className={styles.propDesc}>
                  Carefully packed and fully insured, delivered anywhere in India.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
