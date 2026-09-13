import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Nav } from "@/components/Nav";
import { CommissionForm } from "@/components/commission/CommissionForm";
import styles from "./commission-page.module.css";

interface CommissionPageProps {
  params: Promise<{
    handle: string;
  }>;
}

export async function generateMetadata({ params }: CommissionPageProps) {
  const { handle } = await params;
  const creator = await prisma.creatorProfile.findUnique({
    where: { handle },
  });

  if (!creator) return { title: "Creator Not Found" };

  return {
    title: `Commission Custom Work — ${creator.storeName} | Atelier & Co.`,
    description: `Request a bespoke handcrafted commission with ${creator.storeName}.`,
  };
}

export default async function CommissionPage({ params }: CommissionPageProps) {
  const { handle } = await params;

  const creator = await prisma.creatorProfile.findUnique({
    where: { handle },
    include: {
      user: true,
    },
  });

  if (!creator) {
    notFound();
  }

  return (
    <>
      <Nav />
      <main className={styles.main}>
        <div className="wrap">
          <div className={styles.header}>
            <Link href={`/creators/${creator.handle}`} className={styles.backLink}>
              &larr; Back to {creator.storeName}
            </Link>
            <h1 className={styles.title}>Commission Bespoke Work</h1>
            <p className={styles.subtitle}>
              Collaborate directly with <strong>{creator.storeName}</strong> ({creator.user.name}) to create a one-of-a-kind bespoke piece tailored to your spatial aesthetic and vision.
            </p>
          </div>

          <div className={styles.card}>
            <div className={styles.creatorBanner}>
              <div className={styles.avatar}>
                {creator.profileImageUrl || creator.user.image ? (
                  <img src={creator.profileImageUrl || creator.user.image!} alt={creator.storeName} />
                ) : (
                  <span>{creator.storeName.charAt(0)}</span>
                )}
              </div>
              <div>
                <h3 className={styles.storeName}>{creator.storeName}</h3>
                <div className={styles.disciplineTags}>
                  {creator.disciplines.map((d) => (
                    <span key={d} className={styles.tag}>
                      {d}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <CommissionForm
              creator={{
                id: creator.id,
                storeName: creator.storeName,
                handle: creator.handle,
                disciplines: creator.disciplines,
                user: { name: creator.user.name },
              }}
            />
          </div>
        </div>
      </main>
    </>
  );
}
