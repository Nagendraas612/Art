import Link from "next/link";
import { getCurrentCreator } from "@/lib/studio-auth";
import { ArtworkForm } from "@/components/studio/ArtworkForm";
import { getArtworkFormConfig } from "@/lib/form-schema";
import styles from "../artworks.module.css";

export default async function NewArtworkPage() {
  const creator = await getCurrentCreator();

  if (!creator) {
    return <div className={styles.emptyCard}>Studio not found.</div>;
  }

  const formConfig = await getArtworkFormConfig();

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <Link href="/studio/artworks" className={styles.categoryBadge}>
            &larr; Back to Studio Artworks
          </Link>
          <h1 className={styles.title} style={{ marginTop: "8px" }}>
            List New Crafted Artwork
          </h1>
          <p className={styles.subtitle}>
            Publish a unique 1/1 original or limited handcrafted edition with full craft specifications.
          </p>
        </div>
      </div>

      <ArtworkForm formConfig={formConfig} />
    </div>
  );
}
