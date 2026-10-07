import { prisma } from "@/lib/prisma";
import { SAFE_USER_SELECT } from "@/lib/safe-select";
import { Nav } from "@/components/Nav";
import { CreatorCard } from "@/components/ui/CreatorCard";
import styles from "./creators.module.css";
import { CreatorStatus, ArtworkStatus } from "@prisma/client";
import Link from "next/link";

export const revalidate = 3600;

export const metadata = {
  title: "Artists",
  description: "Meet the painters, potters, weavers, printmakers and woodworkers selling their work on Kalaa Bhadra.",
  alternates: {
    canonical: "https://kalaabhadra.vercel.app/creators",
  },
};

export default async function CreatorsPage() {
  const creators = await prisma.creatorProfile.findMany({
    where: {
      status: CreatorStatus.APPROVED,
    },
    include: {
      user: { select: SAFE_USER_SELECT },
      _count: {
        select: {
          artworks: {
            where: { status: ArtworkStatus.PUBLISHED },
          },
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return (
    <>
      <Nav />
      <main className={styles.main}>
        {/* Header section */}
        <section className={styles.header}>
          <div className="wrap">
            <span className={styles.kicker}>The Artisans</span>
            <h1 className={styles.title}>Meet Our Artists</h1>
            <p className={styles.subtitle}>
              Independent artists and makers, selling their own work directly to you.
            </p>
          </div>
        </section>

        {/* Directory Grid */}
        <section className={`wrap ${styles.gridSection}`}>
          <div className={styles.grid}>
            {creators.map((creator) => (
              <CreatorCard
                key={creator.id}
                id={creator.id}
                handle={creator.handle}
                storeName={creator.storeName}
                tagline={creator.tagline}
                bio={creator.bio}
                coverImageUrl={creator.coverImageUrl}
                profileImageUrl={creator.profileImageUrl || creator.user.image}
                disciplines={creator.disciplines}
                acceptsCustomOrders={creator.acceptsCustomOrders}
                artworkCount={creator._count.artworks}
              />
            ))}
          </div>

          {/* Call to action for prospective creators */}
          <div className={styles.joinBanner}>
            <div className={styles.joinContent}>
              <h2 className={styles.joinTitle}>Are you an artist?</h2>
              <p className={styles.joinText}>
                Sell your work directly to buyers — paintings, ceramics, prints, woodwork, and more.
              </p>
            </div>
            <Link href="/become-a-creator" className={styles.joinBtn}>
              Apply to Join Kalaa Bhadra &rarr;
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
