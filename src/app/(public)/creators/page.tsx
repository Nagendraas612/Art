import { prisma } from "@/lib/prisma";
import { Nav } from "@/components/Nav";
import { CreatorCard } from "@/components/ui/CreatorCard";
import styles from "./creators.module.css";
import { CreatorStatus, ArtworkStatus } from "@prisma/client";
import Link from "next/link";

export const metadata = {
  title: "Artisans & Creators — Atelier & Co.",
  description: "Meet the master ceramists, painters, weavers, printmakers, and woodworkers showcasing their crafts on Atelier.",
};

export default async function CreatorsPage() {
  const creators = await prisma.creatorProfile.findMany({
    where: {
      status: CreatorStatus.APPROVED,
    },
    include: {
      user: true,
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
            <h1 className={styles.title}>Meet Our Creators</h1>
            <p className={styles.subtitle}>
              Every creator on Atelier is an independent maker dedicated to authentic materials,
              traditional crafts, and intentional design.
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
              <h2 className={styles.joinTitle}>Are you a master of your craft?</h2>
              <p className={styles.joinText}>
                We provide a refined platform for independent artists, ceramists, printmakers, and
                woodworkers to showcase and sell their works directly to discerning collectors.
              </p>
            </div>
            <Link href="/become-a-creator" className={styles.joinBtn}>
              Apply to Join the Atelier &rarr;
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
