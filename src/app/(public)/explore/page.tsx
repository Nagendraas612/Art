import { prisma } from "@/lib/prisma";
import { getSession } from "@/modules/auth/guards";
import { Nav } from "@/components/Nav";
import { ArtworkCard } from "@/components/ui/ArtworkCard";
import Link from "next/link";
import styles from "./explore.module.css";
import { ArtworkProductType, ArtworkStatus } from "@prisma/client";

interface ExplorePageProps {
  searchParams: Promise<{
    category?: string;
    type?: string;
    sort?: string;
    q?: string;
    minPrice?: string;
    maxPrice?: string;
  }>;
}

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Explore Gallery — Atelier & Co.",
  description: "Browse original paintings, handcrafted ceramics, fiber arts, limited edition prints, and woodwork from independent master artisans.",
};

export default async function ExplorePage({ searchParams }: ExplorePageProps) {
  const params = await searchParams;
  const currentCategorySlug = params.category;
  const currentType = params.type as ArtworkProductType | undefined;
  const currentSort = params.sort || "newest";
  const searchQuery = params.q?.trim();
  const minPriceNum = params.minPrice ? parseFloat(params.minPrice) : undefined;
  const maxPriceNum = params.maxPrice ? parseFloat(params.maxPrice) : undefined;

  // 1. Fetch all active categories
  const categories = await prisma.artworkCategory.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });

  // 2. Build where filter
  const where: any = {
    status: ArtworkStatus.PUBLISHED,
  };

  if (currentCategorySlug) {
    where.category = { slug: currentCategorySlug };
  }

  if (currentType && Object.values(ArtworkProductType).includes(currentType)) {
    where.productType = currentType;
  }

  if (searchQuery) {
    where.OR = [
      { title: { contains: searchQuery, mode: "insensitive" } },
      { description: { contains: searchQuery, mode: "insensitive" } },
      { creator: { storeName: { contains: searchQuery, mode: "insensitive" } } },
      { creator: { user: { name: { contains: searchQuery, mode: "insensitive" } } } },
    ];
  }

  if (minPriceNum !== undefined || maxPriceNum !== undefined) {
    where.price = {};
    if (minPriceNum !== undefined && !isNaN(minPriceNum)) {
      where.price.gte = minPriceNum;
    }
    if (maxPriceNum !== undefined && !isNaN(maxPriceNum)) {
      where.price.lte = maxPriceNum;
    }
  }

  // 3. Build sorting
  let orderBy: any = { publishedAt: "desc" };
  if (currentSort === "price_asc") {
    orderBy = { price: "asc" };
  } else if (currentSort === "price_desc") {
    orderBy = { price: "desc" };
  }

  // 4. Fetch artworks with images, creator, and category
  const artworks = await prisma.artwork.findMany({
    where,
    orderBy,
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
    },
  });

  // 5. Fetch user's wishlist for heart states
  const session = await getSession();
  let userWishlistIds = new Set<string>();
  let userId = session?.user?.id;
  if (!userId) {
    const demo = await prisma.user.findUnique({ where: { email: "collector@example.com" } });
    userId = demo?.id;
  }
  if (userId) {
    const wishlistItems = await prisma.wishlistItem.findMany({
      where: { wishlist: { userId } },
      select: { artworkId: true },
    });
    userWishlistIds = new Set(wishlistItems.map((w) => w.artworkId));
  }

  const activeCategory = categories.find((c) => c.slug === currentCategorySlug);

  return (
    <>
      <Nav />
      <main className={styles.main}>
        {/* Header section */}
        <section className={styles.header}>
          <div className="wrap">
            <span className={styles.kicker}>The Collection</span>
            <h1 className={styles.title}>
              {searchQuery
                ? `Search: "${searchQuery}"`
                : activeCategory
                ? activeCategory.name
                : "Discover All Pieces"}
            </h1>
            <p className={styles.subtitle}>
              {searchQuery
                ? `Showing ${artworks.length} ${artworks.length === 1 ? "match" : "matches"} for "${searchQuery}"`
                : activeCategory?.description ||
                  "A curated archive of museum-grade original art, stoneware, textiles, prints, and heirloom woodwork."}
            </p>

            {searchQuery && (
              <div style={{ marginTop: "16px" }}>
                <Link href="/explore" className={styles.pill} style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  <span>&times; Clear search filter</span>
                </Link>
              </div>
            )}
          </div>
        </section>

        {/* Filter bar */}
        <section className={styles.filterSection}>
          <div className={`wrap ${styles.filterBar}`}>
            {/* Category Pills */}
            <div className={styles.categoryPills}>
              <Link
                href={searchQuery ? `/explore?q=${encodeURIComponent(searchQuery)}` : "/explore"}
                className={`${styles.pill} ${!currentCategorySlug ? styles.activePill : ""}`}
              >
                All Works ({artworks.length})
              </Link>
              {categories.map((cat) => {
                const isActive = currentCategorySlug === cat.slug;
                return (
                  <Link
                    key={cat.id}
                    href={`/explore?${new URLSearchParams({
                      category: cat.slug,
                      ...(searchQuery && { q: searchQuery }),
                      ...(currentSort !== "newest" && { sort: currentSort }),
                    }).toString()}`}
                    className={`${styles.pill} ${isActive ? styles.activePill : ""}`}
                  >
                    {cat.name}
                  </Link>
                );
              })}
            </div>

            {/* Sort Dropdown / Links */}
            <div className={styles.sortControls}>
              <span className={styles.sortLabel}>Sort:</span>
              <div className={styles.sortOptions}>
                <Link
                  href={`/explore?${new URLSearchParams({
                    ...(currentCategorySlug && { category: currentCategorySlug }),
                    ...(currentType && { type: currentType }),
                    ...(searchQuery && { q: searchQuery }),
                    sort: "newest",
                  }).toString()}`}
                  className={`${styles.sortLink} ${currentSort === "newest" ? styles.activeSort : ""}`}
                >
                  Featured
                </Link>
                <Link
                  href={`/explore?${new URLSearchParams({
                    ...(currentCategorySlug && { category: currentCategorySlug }),
                    ...(currentType && { type: currentType }),
                    ...(searchQuery && { q: searchQuery }),
                    sort: "price_asc",
                  }).toString()}`}
                  className={`${styles.sortLink} ${currentSort === "price_asc" ? styles.activeSort : ""}`}
                >
                  Price: Low &uarr;
                </Link>
                <Link
                  href={`/explore?${new URLSearchParams({
                    ...(currentCategorySlug && { category: currentCategorySlug }),
                    ...(currentType && { type: currentType }),
                    ...(searchQuery && { q: searchQuery }),
                    sort: "price_desc",
                  }).toString()}`}
                  className={`${styles.sortLink} ${currentSort === "price_desc" ? styles.activeSort : ""}`}
                >
                  Price: High &darr;
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Artworks Grid */}
        <section className={`wrap ${styles.gridSection}`}>
          {artworks.length === 0 ? (
            <div className={styles.emptyState}>
              <h3 className={styles.emptyTitle}>No artworks found</h3>
              <p className={styles.emptyText}>
                No pieces match your selected filters. Try clearing the filter to view all pieces.
              </p>
              <Link href="/explore" className={styles.resetBtn}>
                Clear Filters
              </Link>
            </div>
          ) : (
            <div className={styles.grid}>
              {artworks.map((art) => {
                const mainImage = art.images[0]?.url;
                const altText = art.images[0]?.altText || art.title;
                const specs = art.specifications as Record<string, any> | null;
                const medium = specs?.medium || specs?.clayBody || specs?.fibers || specs?.timber || specs?.printingMethod;

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
          )}
        </section>
      </main>
    </>
  );
}
