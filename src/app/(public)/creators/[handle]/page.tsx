import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/modules/auth/guards";
import { Nav } from "@/components/Nav";
import { ArtworkCard } from "@/components/ui/ArtworkCard";
import Link from "next/link";
import styles from "./creator-profile.module.css";
import { ArtworkStatus } from "@prisma/client";
import { MessageArtistModal } from "@/components/ui/MessageArtistModal";
import { FollowButton } from "@/components/ui/FollowButton";

interface CreatorProfilePageProps {
  params: Promise<{
    handle: string;
  }>;
}

export async function generateMetadata({ params }: CreatorProfilePageProps) {
  const { handle } = await params;
  const creator = await prisma.creatorProfile.findUnique({
    where: { handle },
    include: { user: true },
  });

  if (!creator) return { title: "Creator Not Found" };

  return {
    title: `${creator.storeName} (@${creator.handle}) — Atelier & Co.`,
    description: creator.bio || creator.tagline || `Artworks and handmade pieces by ${creator.user.name}`,
  };
}

export default async function CreatorProfilePage({ params }: CreatorProfilePageProps) {
  const { handle } = await params;

  const creator = await prisma.creatorProfile.findUnique({
    where: { handle },
    include: {
      user: true,
      artworks: {
        where: { status: ArtworkStatus.PUBLISHED },
        include: {
          images: {
            orderBy: { sortOrder: "asc" },
          },
        },
        orderBy: { publishedAt: "desc" },
      },
    },
  });

  if (!creator) {
    notFound();
  }

  const session = await getSession();
  let isFollowing = false;
  let followerUserId = session?.user?.id;
  if (!followerUserId) {
    const defaultUser = await prisma.user.findUnique({ where: { email: "collector@example.com" } });
    followerUserId = defaultUser?.id;
  }

  if (followerUserId) {
    const followRecord = await prisma.follow.findUnique({
      where: {
        followerId_creatorId: {
          followerId: followerUserId,
          creatorId: creator.id,
        },
      },
    });
    isFollowing = !!followRecord;
  }

  const followerCount = await prisma.follow.count({
    where: { creatorId: creator.id },
  });

  return (
    <>
      <Nav />
      <main className={styles.main}>
        {/* Cover image banner */}
        <div className={styles.coverWrapper}>
          {creator.coverImageUrl ? (
            <img src={creator.coverImageUrl} alt={creator.storeName} className={styles.coverImage} />
          ) : (
            <div className={styles.coverPlaceholder} />
          )}
        </div>

        {/* Creator Info Bar */}
        <div className={`wrap ${styles.profileContent}`}>
          <div className={styles.headerRow}>
            <div className={styles.avatarWrap}>
              {creator.profileImageUrl || creator.user.image ? (
                <img
                  src={creator.profileImageUrl || creator.user.image!}
                  alt={creator.user.name}
                  className={styles.avatar}
                />
              ) : (
                <div className={styles.avatarFallback}>{creator.storeName.charAt(0)}</div>
              )}
            </div>

            <div className={styles.actionButtons}>
              <FollowButton
                creatorId={creator.id}
                initialFollowing={isFollowing}
                initialCount={followerCount}
              />
              <MessageArtistModal
                creatorId={creator.id}
                creatorName={creator.user.name}
                storeName={creator.storeName}
                triggerText="Direct Message Studio"
                className={styles.customBtn}
              />
              <Link href={`/creators/${creator.handle}/commission`} className={styles.customBtn}>
                Request Custom Commission
              </Link>
            </div>
          </div>

          <div className={styles.infoSection}>
            <div className={styles.titleArea}>
              <h1 className={styles.storeName}>{creator.storeName}</h1>
              <div className={styles.creatorMeta}>
                <span className={styles.artistName}>by {creator.user.name}</span>
                <span className={styles.dot}>•</span>
                <span className={styles.handle}>@{creator.handle}</span>
              </div>
            </div>

            {creator.tagline && <p className={styles.tagline}>{creator.tagline}</p>}

            <div className={styles.disciplines}>
              {creator.disciplines.map((d) => (
                <span key={d} className={styles.disciplineTag}>
                  {d}
                </span>
              ))}
            </div>

            {creator.bio && <p className={styles.bio}>{creator.bio}</p>}
          </div>

          {/* Artworks section */}
          <section className={styles.artworksSection}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>
                Available Works ({creator.artworks.length})
              </h2>
            </div>

            {creator.artworks.length === 0 ? (
              <div className={styles.emptyGallery}>
                <p>No works currently published in this studio.</p>
              </div>
            ) : (
              <div className={styles.grid}>
                {creator.artworks.map((art) => {
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
                        name: creator.user.name,
                        handle: creator.handle,
                        avatarUrl: creator.profileImageUrl || creator.user.image,
                      }}
                      medium={medium}
                      isSigned={art.isSigned}
                      hasCertificate={art.hasCertificate}
                      editionSize={art.editionSize}
                      editionSold={art.editionSold}
                    />
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </main>
    </>
  );
}
