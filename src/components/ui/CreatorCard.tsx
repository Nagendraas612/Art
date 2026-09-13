import Link from "next/link";
import { FollowButton } from "@/components/ui/FollowButton";
import styles from "./CreatorCard.module.css";

export interface CreatorCardProps {
  id: string;
  handle: string;
  storeName: string;
  tagline?: string | null;
  bio?: string | null;
  coverImageUrl?: string | null;
  profileImageUrl?: string | null;
  disciplines: string[];
  acceptsCustomOrders?: boolean;
  artworkCount?: number;
  isFollowing?: boolean;
  followerCount?: number;
}

export function CreatorCard({
  id,
  handle,
  storeName,
  tagline,
  bio,
  coverImageUrl,
  profileImageUrl,
  disciplines,
  acceptsCustomOrders,
  artworkCount,
  isFollowing,
  followerCount,
}: CreatorCardProps) {
  return (
    <article className={styles.card}>
      <Link href={`/creators/${handle}`} className={styles.coverLink}>
        <div className={styles.coverWrap}>
          {coverImageUrl ? (
            <img src={coverImageUrl} alt={storeName} className={styles.coverImage} loading="lazy" />
          ) : (
            <div className={styles.coverPlaceholder} />
          )}
          {acceptsCustomOrders && (
            <span className={styles.customBadge}>Custom Commissions Open</span>
          )}
        </div>
      </Link>

      <div className={styles.body}>
        <div className={styles.avatarRow}>
          <div className={styles.avatarWrap}>
            {profileImageUrl ? (
              <img src={profileImageUrl} alt={storeName} className={styles.avatar} />
            ) : (
              <div className={styles.avatarFallback}>{storeName.charAt(0)}</div>
            )}
          </div>
          {typeof artworkCount === "number" && (
            <span className={styles.artCount}>{artworkCount} Pieces</span>
          )}
        </div>

        <h3 className={styles.storeName}>
          <Link href={`/creators/${handle}`}>{storeName}</Link>
        </h3>
        <p className={styles.handle}>@{handle}</p>

        {tagline && <p className={styles.tagline}>{tagline}</p>}

        <div className={styles.disciplineList}>
          {disciplines.map((d) => (
            <span key={d} className={styles.disciplineTag}>
              {d}
            </span>
          ))}
        </div>

        <div className={styles.footer}>
          <Link href={`/creators/${handle}`} className={styles.profileBtn}>
            Visit Studio &rarr;
          </Link>
          {id && (
            <FollowButton
              creatorId={id}
              initialFollowing={isFollowing}
              initialCount={followerCount}
              compact
            />
          )}
        </div>
      </div>
    </article>
  );
}
