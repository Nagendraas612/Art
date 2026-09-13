"use client";

import React, { useState } from "react";
import { submitReviewAction } from "@/app/actions/reviews";
import styles from "./ReviewsSection.module.css";

export interface ReviewItem {
  id: string;
  rating: number;
  text: string | null;
  imageUrl: string | null;
  isVerifiedPurchase: boolean;
  createdAt: Date | string;
  author: {
    name: string;
    image?: string | null;
  };
}

interface ReviewsSectionProps {
  artworkId: string;
  initialReviews: ReviewItem[];
}

export function ReviewsSection({ artworkId, initialReviews }: ReviewsSectionProps) {
  const [reviews, setReviews] = useState<ReviewItem[]>(initialReviews);
  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [text, setText] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [authorEmail, setAuthorEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const averageRating =
    reviews.length > 0
      ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)
      : "5.0";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!text.trim()) {
      setErrorMessage("Please share your thoughts on the artwork.");
      return;
    }

    setIsSubmitting(true);

    const res = await submitReviewAction({
      artworkId,
      rating,
      text,
      authorName: authorName || "Verified Collector",
      authorEmail: authorEmail || "collector@example.com",
    });

    setIsSubmitting(false);

    if (res.error) {
      setErrorMessage(res.error);
    } else if (res.review) {
      setReviews((prev) => [res.review as any, ...prev]);
      setText("");
      setSuccessMessage("Thank you! Your verified collector review has been published.");
      setTimeout(() => {
        setShowForm(false);
        setSuccessMessage(null);
      }, 2500);
    }
  };

  return (
    <section className={styles.section} id="reviews">
      <div className={styles.header}>
        <div>
          <h3 className={styles.title}>Collector Reviews &amp; Provenance</h3>
          <p className={styles.subtitle}>
            Verified appraisals and collector impressions from our patron community.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className={styles.writeReviewBtn}
        >
          {showForm ? "Close Form" : "Write a Review"}
        </button>
      </div>

      {/* Rating Summary Bar */}
      <div className={styles.summaryBar}>
        <div className={styles.scoreBox}>
          <span className={styles.scoreNumber}>{averageRating}</span>
          <div className={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <span key={star} className={styles.starFilled}>
                ★
              </span>
            ))}
          </div>
          <span className={styles.reviewCount}>
            Based on {reviews.length} {reviews.length === 1 ? "review" : "reviews"}
          </span>
        </div>

        <div className={styles.provenanceNotice}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <div>
            <strong>100% Verified Acquisitions</strong>
            <p>Reviews are submitted by verified collectors and studio patrons.</p>
          </div>
        </div>
      </div>

      {/* Review Submission Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className={styles.formCard}>
          <h4 className={styles.formTitle}>Leave an Artisanal Appraisal</h4>

          {errorMessage && <div className={styles.errorAlert}>{errorMessage}</div>}
          {successMessage && <div className={styles.successAlert}>{successMessage}</div>}

          <div className={styles.formGrid}>
            <div>
              <label>Your Rating *</label>
              <div className={styles.starPicker}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    className={`${styles.starBtn} ${
                      (hoverRating || rating) >= star ? styles.starActive : ""
                    }`}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => setRating(star)}
                  >
                    ★
                  </button>
                ))}
                <span className={styles.ratingLabel}>{rating} of 5 Stars</span>
              </div>
            </div>

            <div>
              <label htmlFor="authorName">Your Name</label>
              <input
                type="text"
                id="authorName"
                placeholder="e.g. Anandita S."
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
              />
            </div>

            <div className={styles.fullWidth}>
              <label htmlFor="reviewText">Your Review &amp; Experience *</label>
              <textarea
                id="reviewText"
                rows={3}
                required
                placeholder="Describe the texture, framing, color depth, or studio craftsmanship upon unboxing..."
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </div>
          </div>

          <div className={styles.formActions}>
            <button
              type="submit"
              disabled={isSubmitting}
              className={styles.submitReviewBtn}
            >
              {isSubmitting ? "Publishing..." : "Submit Verified Review"}
            </button>
          </div>
        </form>
      )}

      {/* Reviews List */}
      {reviews.length === 0 ? (
        <div className={styles.emptyReviews}>
          <p>No reviews yet for this masterpiece. Be the first patron to leave an appraisal!</p>
        </div>
      ) : (
        <div className={styles.reviewsList}>
          {reviews.map((r) => {
            const dateStr = new Intl.DateTimeFormat("en-IN", {
              dateStyle: "medium",
            }).format(new Date(r.createdAt));

            return (
              <div key={r.id} className={styles.reviewCard}>
                <div className={styles.reviewHead}>
                  <div className={styles.authorInfo}>
                    <div className={styles.authorAvatar}>
                      {r.author?.image ? (
                        <img src={r.author.image} alt={r.author.name} />
                      ) : (
                        <span>{r.author?.name?.charAt(0) || "P"}</span>
                      )}
                    </div>
                    <div>
                      <div className={styles.authorNameRow}>
                        <strong className={styles.authorName}>
                          {r.author?.name || "Verified Collector"}
                        </strong>
                        {r.isVerifiedPurchase && (
                          <span className={styles.verifiedBadge}>Verified Purchase</span>
                        )}
                      </div>
                      <span className={styles.reviewDate}>{dateStr}</span>
                    </div>
                  </div>

                  <div className={styles.cardStars}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <span
                        key={s}
                        className={s <= r.rating ? styles.starFilled : styles.starEmpty}
                      >
                        ★
                      </span>
                    ))}
                  </div>
                </div>

                {r.text && <p className={styles.reviewBody}>{r.text}</p>}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
