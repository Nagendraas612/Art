import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentCreator } from "@/lib/studio-auth";
import { ArtworkForm } from "@/components/studio/ArtworkForm";
import styles from "@/app/studio/artworks/artworks.module.css";

interface EditArtworkPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function EditArtworkPage({ params }: EditArtworkPageProps) {
  const { id } = await params;
  const creator = await getCurrentCreator();

  if (!creator) {
    notFound();
  }

  const artwork = await prisma.artwork.findFirst({
    where: {
      id,
      creatorId: creator.id,
    },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      category: true,
    },
  });

  if (!artwork) {
    notFound();
  }

  const categories = await prisma.artworkCategory.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });

  const priceNum = typeof artwork.price === "number" ? artwork.price : parseFloat(artwork.price.toString());

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <Link href="/studio/artworks" className={styles.categoryBadge}>
            &larr; Back to Studio Artworks
          </Link>
          <h1 className={styles.title} style={{ marginTop: "8px" }}>
            Edit Artwork: {artwork.title}
          </h1>
          <p className={styles.subtitle}>
            Update dimensions, specifications, inventory, and gallery imagery.
          </p>
        </div>
      </div>

      <ArtworkForm
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        initialData={{
          id: artwork.id,
          title: artwork.title,
          categoryId: artwork.categoryId,
          productType: artwork.productType,
          status: artwork.status,
          price: priceNum,
          description: artwork.description,
          stock: artwork.stock,
          editionSize: artwork.editionSize,
          widthCm: artwork.widthCm ? parseFloat(artwork.widthCm.toString()) : null,
          heightCm: artwork.heightCm ? parseFloat(artwork.heightCm.toString()) : null,
          depthCm: artwork.depthCm ? parseFloat(artwork.depthCm.toString()) : null,
          weightGrams: artwork.weightGrams,
          isSigned: artwork.isSigned,
          hasCertificate: artwork.hasCertificate,
          provenanceNote: artwork.provenanceNote,
          isFragile: artwork.isFragile,
          processingDays: artwork.processingDays,
          specifications: (artwork.specifications as Record<string, any>) || {},
          images: artwork.images.map((img) => ({ url: img.url, kind: img.kind })),
        }}
      />
    </div>
  );
}
