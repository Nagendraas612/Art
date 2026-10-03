"use client";

import { useState } from "react";
import Image from "next/image";
import styles from "./ArtworkGallery.module.css";

export interface GalleryImage {
  id?: string;
  url: string;
  altText?: string | null;
}

interface ArtworkGalleryProps {
  mainImage: string | null;
  mainAlt: string;
  detailImages: GalleryImage[];
  isOriginal: boolean;
}

/**
 * Artwork image gallery: the main image plus clickable detail thumbnails.
 * Previously the thumbnails were inert divs — clicking them did nothing.
 */
export function ArtworkGallery({
  mainImage,
  mainAlt,
  detailImages,
  isOriginal,
}: ArtworkGalleryProps) {
  const all: GalleryImage[] = [
    ...(mainImage ? [{ url: mainImage, altText: mainAlt }] : []),
    ...detailImages,
  ];
  const [activeIndex, setActiveIndex] = useState(0);
  const active = all[Math.min(activeIndex, all.length - 1)];

  return (
    <div className={styles.galleryCol}>
      <div className={styles.mainImageWrap}>
        {active ? (
          <Image
            src={active.url}
            alt={active.altText || mainAlt}
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 60vw"
            className={styles.mainImage}
          />
        ) : (
          <div className={styles.placeholderImage}>No image available</div>
        )}
        {isOriginal && (
          <span className={styles.badgeFloating}>Unique 1/1 Original</span>
        )}
      </div>

      {all.length > 1 && (
        <div className={styles.detailGrid} role="listbox" aria-label="Artwork images">
          {all.map((img, idx) => (
            <button
              key={img.id || `${img.url}-${idx}`}
              type="button"
              role="option"
              aria-selected={idx === activeIndex}
              aria-label={`View image ${idx + 1}`}
              onClick={() => setActiveIndex(idx)}
              className={`${styles.detailThumb} ${idx === activeIndex ? styles.detailThumbActive : ""}`}
            >
              <Image
                src={img.url}
                alt={img.altText || `Detail ${idx + 1}`}
                fill
                sizes="(max-width: 1024px) 33vw, 20vw"
                className={styles.detailImage}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
