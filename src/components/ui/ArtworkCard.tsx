import Link from "next/link";
import { WishlistButton } from "@/components/ui/WishlistButton";
import styles from "./ArtworkCard.module.css";

export interface ArtworkCardProps {
  id: string;
  slug: string;
  title: string;
  price: number | string;
  currency?: string;
  productType: string;
  imageUrl?: string | null;
  imageAlt?: string | null;
  creator: {
    name: string;
    handle: string;
    avatarUrl?: string | null;
  };
  medium?: string;
  isSigned?: boolean;
  hasCertificate?: boolean;
  editionSize?: number | null;
  editionSold?: number | null;
  isWishlisted?: boolean;
}

export function ArtworkCard({
  id,
  slug,
  title,
  price,
  currency = "INR",
  productType,
  imageUrl,
  imageAlt,
  creator,
  medium,
  isSigned,
  hasCertificate,
  editionSize,
  editionSold,
  isWishlisted,
}: ArtworkCardProps) {
  const numPrice = typeof price === "number" ? price : parseFloat(price) || 0;
  const formattedPrice = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency,
    maximumFractionDigits: 0,
  }).format(numPrice);

  const getProductTypeBadge = () => {
    switch (productType) {
      case "ORIGINAL":
        return <span className={`${styles.badge} ${styles.badgeOriginal}`}>Original 1/1</span>;
      case "LIMITED_EDITION":
        return (
          <span className={`${styles.badge} ${styles.badgeEdition}`}>
            Edition {editionSold ?? 0}/{editionSize ?? "—"}
          </span>
        );
      case "MADE_TO_ORDER":
        return <span className={`${styles.badge} ${styles.badgeMto}`}>Made to Order</span>;
      case "DIGITAL":
        return <span className={`${styles.badge} ${styles.badgeDigital}`}>Digital</span>;
      default:
        return null;
    }
  };

  return (
    <article className={styles.card}>
      <div className={styles.imageWrap}>
        <Link href={`/artwork/${slug || id}`} className={styles.imageLink} aria-label={title}>
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={imageAlt || title}
              className={styles.image}
              loading="lazy"
            />
          ) : (
            <div className={styles.placeholder}>
              <span>No image preview</span>
            </div>
          )}
        </Link>
        <div className={styles.badgeWrap}>{getProductTypeBadge()}</div>
        <div className={styles.wishlistWrap}>
          <WishlistButton artworkId={id} initialWishlisted={isWishlisted} size="sm" />
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.metaRow}>
          <Link href={`/creators/${creator.handle}`} className={styles.creatorLink}>
            {creator.avatarUrl && (
              <img
                src={creator.avatarUrl}
                alt={creator.name}
                className={styles.creatorAvatar}
              />
            )}
            <span className={styles.creatorName}>{creator.name}</span>
          </Link>

          {(isSigned || hasCertificate) && (
            <div className={styles.authenticity} title="Verified Authenticity">
              {isSigned && <span className={styles.authDot} title="Signed by Artist">✍ Signed</span>}
            </div>
          )}
        </div>

        <h3 className={styles.title}>
          <Link href={`/artwork/${slug || id}`}>{title}</Link>
        </h3>

        {medium && <p className={styles.medium}>{medium}</p>}

        <div className={styles.footer}>
          <span className={styles.price}>{formattedPrice}</span>
          <Link href={`/artwork/${slug || id}`} className={styles.viewBtn}>
            View Piece
          </Link>
        </div>
      </div>
    </article>
  );
}
