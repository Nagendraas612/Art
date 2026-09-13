import { prisma } from "@/lib/prisma";
import { getSession } from "@/modules/auth/guards";
import { Nav } from "@/components/Nav";
import { ArtworkCard } from "@/components/ui/ArtworkCard";
import Link from "next/link";
import styles from "./wishlist.module.css";
import { ArtworkStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Saved Collection — Your Curated Pieces | Atelier & Co.",
  description: "Browse and manage your personal wishlist of exceptional fine art and craft pieces.",
};

async function resolveUserId(): Promise<string | null> {
  const session = await getSession();
  if (session?.user?.id) return session.user.id;

  const email = "collector@example.com";
  const user = await prisma.user.findUnique({ where: { email } });
  return user?.id || null;
}

export default async function WishlistPage() {
  const userId = await resolveUserId();

  const items = userId
    ? await prisma.wishlistItem.findMany({
        where: {
          wishlist: {
            userId,
          },
          artwork: {
            status: ArtworkStatus.PUBLISHED,
          },
        },
        include: {
          artwork: {
            include: {
              creator: {
                include: {
                  user: true,
                },
              },
              images: {
                orderBy: { sortOrder: "asc" },
                take: 1,
              },
            },
          },
        },
        orderBy: { addedAt: "desc" },
      })
    : [];

  const artworks = items.map((i) => i.artwork);

  return (
    <>
      <Nav />
      <main className={styles.main}>
        <div className="wrap">
          {/* Header */}
          <div className={styles.header}>
            <span className={styles.badge}>Curated Gallery</span>
            <h1 className={styles.title}>Your Saved Collection</h1>
            <p className={styles.subtitle}>
              {artworks.length === 0
                ? "Your personal art collection is currently waiting for its first acquisition."
                : `You have saved ${artworks.length} exceptional ${artworks.length === 1 ? "work" : "works"} to your private collection.`}
            </p>
          </div>

          {/* Gallery Grid or Empty State */}
          {artworks.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIconWrap}>
                <svg
                  width="40"
                  height="40"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
              </div>
              <h2 className={styles.emptyTitle}>Your Wishlist is Empty</h2>
              <p className={styles.emptyText}>
                As you browse Atelier &amp; Co., click the heart icon on any piece to save it to your private portfolio for later acquisition.
              </p>
              <Link href="/explore" className={styles.exploreBtn}>
                Explore Featured Artworks &rarr;
              </Link>
            </div>
          ) : (
            <div className={styles.grid}>
              {artworks.map((item) => {
                const specs = (item.specifications as Record<string, any>) || {};
                const firstImg = item.images[0];
                return (
                  <ArtworkCard
                    key={item.id}
                    id={item.id}
                    slug={item.slug}
                    title={item.title}
                    price={item.price.toString()}
                    currency={item.currency}
                    productType={item.productType}
                    imageUrl={firstImg?.url}
                    imageAlt={firstImg?.altText || item.title}
                    creator={{
                      name: item.creator.user.name,
                      handle: item.creator.handle,
                      avatarUrl: item.creator.profileImageUrl || item.creator.user.image,
                    }}
                    medium={specs.medium}
                    isSigned={specs.isSigned}
                    hasCertificate={specs.hasCertificate}
                    editionSize={item.editionSize}
                    editionSold={item.editionSold}
                    isWishlisted={true}
                  />
                );
              })}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
