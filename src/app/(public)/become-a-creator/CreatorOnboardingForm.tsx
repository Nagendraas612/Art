"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createCreatorProfile } from "@/modules/creator/actions";
import { DragDropUploader } from "@/components/ui/DragDropUploader";
import styles from "./become-a-creator.module.css";
import Link from "next/link";

const DISCIPLINE_OPTIONS = [
  "Oil Painting",
  "Watercolor",
  "Ceramics & Pottery",
  "Sculpture",
  "Tapestry & Fiber Art",
  "Relief & Linocut Prints",
  "Woodturning & Joinery",
  "Jewelry & Metalsmithing",
  "Botanical Illustration",
  "Glasswork",
];

interface CreatorOnboardingFormProps {
  user: {
    id: string;
    name: string;
    email: string;
    image?: string | null;
  } | null;
  existingProfile?: {
    handle: string;
    storeName: string;
    tagline?: string | null;
    bio?: string | null;
    disciplines: string[];
    coverImageUrl?: string | null;
    profileImageUrl?: string | null;
    acceptsCustomOrders: boolean;
  } | null;
}

export function CreatorOnboardingForm({ user, existingProfile }: CreatorOnboardingFormProps) {
  const router = useRouter();

  const [handle, setHandle] = useState(existingProfile?.handle || "");
  const [storeName, setStoreName] = useState(existingProfile?.storeName || (user ? `${user.name} Studio` : ""));
  const [tagline, setTagline] = useState(existingProfile?.tagline || "");
  const [bio, setBio] = useState(existingProfile?.bio || "");
  const [selectedDisciplines, setSelectedDisciplines] = useState<string[]>(
    existingProfile?.disciplines || ["Oil Painting"]
  );
  const [coverImageUrl, setCoverImageUrl] = useState(
    existingProfile?.coverImageUrl || ""
  );
  const [profileImageUrl, setProfileImageUrl] = useState(
    existingProfile?.profileImageUrl || user?.image || ""
  );
  const [acceptsCustomOrders, setAcceptsCustomOrders] = useState(existingProfile?.acceptsCustomOrders ?? true);
  const [submitted, setSubmitted] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) {
    return (
      <div className={styles.authNotice}>
        <h3 className={styles.noticeTitle}>Sign in to launch your studio</h3>
        <p className={styles.noticeText}>
          You need an active Atelier collector account before setting up your creator profile and store.
        </p>
        <div className={styles.authActions}>
          <Link href="/sign-in?callbackUrl=/become-a-creator" className={styles.btnPrimary}>
            Sign In
          </Link>
          <Link href="/sign-up?callbackUrl=/become-a-creator" className={styles.btnSecondary}>
            Create an Account
          </Link>
        </div>
      </div>
    );
  }

  const handleDisciplineToggle = (item: string) => {
    if (selectedDisciplines.includes(item)) {
      setSelectedDisciplines(selectedDisciplines.filter((d) => d !== item));
    } else {
      setSelectedDisciplines([...selectedDisciplines, item]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await createCreatorProfile({
        handle,
        storeName,
        tagline,
        bio,
        disciplines: selectedDisciplines,
        coverImageUrl,
        profileImageUrl,
        acceptsCustomOrders,
      });

      if (!res.success) {
        setError(res.error || "Failed to submit application.");
        setLoading(false);
        return;
      }

      setSubmitted(true);
      setLoading(false);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className={styles.authNotice}>
        <div className={styles.successIcon}>✓</div>
        <h3 className={styles.noticeTitle}>Application Sent!</h3>
        <p className={styles.noticeText}>
          Your creator application has been submitted successfully. An admin will review your
          profile and get in touch with you via the messaging system.
        </p>
        <p className={styles.waitingText}>⏳ Waiting for admin to accept your application...</p>
        <div className={styles.authActions}>
          <Link href="/messages" className={styles.btnPrimary}>
            View Messages
          </Link>
          <Link href="/explore" className={styles.btnSecondary}>
            Continue Exploring
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      {error && <div className={styles.errorBox}>{error}</div>}

      <div className={styles.section}>
        <h2 className={styles.sectionHeading}>Studio Identity</h2>
        <div className={styles.fieldGrid}>
          <div className={styles.field}>
            <label htmlFor="storeName" className={styles.label}>
              Studio / Brand Name *
            </label>
            <input
              id="storeName"
              type="text"
              required
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              placeholder="e.g. Vance Ceramic Arts"
              className={styles.input}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="handle" className={styles.label}>
              Unique Studio Handle *
            </label>
            <div className={styles.handleInputWrap}>
              <span className={styles.handlePrefix}>@</span>
              <input
                id="handle"
                type="text"
                required
                value={handle}
                onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ""))}
                placeholder="studio-name"
                className={styles.handleInput}
              />
            </div>
            <span className={styles.hint}>Your studio URL: atelier.art/@{handle || "handle"}</span>
          </div>
        </div>

        <div className={styles.field}>
          <label htmlFor="tagline" className={styles.label}>
            Studio Tagline
          </label>
          <input
            id="tagline"
            type="text"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            placeholder="e.g. Minimalist stoneware sculpted with raw ash & iron glazes"
            className={styles.input}
          />
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionHeading}>Crafts &amp; Specialties</h2>
        <p className={styles.sectionHint}>Select the mediums and traditions you practice:</p>
        <div className={styles.tagsGrid}>
          {DISCIPLINE_OPTIONS.map((item) => {
            const isSelected = selectedDisciplines.includes(item);
            return (
              <button
                type="button"
                key={item}
                onClick={() => handleDisciplineToggle(item)}
                className={`${styles.tagButton} ${isSelected ? styles.tagButtonActive : ""}`}
              >
                {item}
              </button>
            );
          })}
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionHeading}>Artist Bio &amp; Philosophy</h2>
        <div className={styles.field}>
          <label htmlFor="bio" className={styles.label}>
            About your journey and studio practice
          </label>
          <textarea
            id="bio"
            rows={4}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Share your techniques, inspiration, materials, and workshop traditions..."
            className={styles.textarea}
          />
        </div>

        <div className={styles.checkboxField}>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={acceptsCustomOrders}
              onChange={(e) => setAcceptsCustomOrders(e.target.checked)}
              className={styles.checkbox}
            />
            <span>Open to custom commissions &amp; bespoke architectural requests</span>
          </label>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionHeading}>Imagery &amp; Aesthetics</h2>
        <div className={styles.fieldGrid}>
          <DragDropUploader
            label="Portrait / Studio Avatar"
            value={profileImageUrl}
            onChange={(url) => setProfileImageUrl(url)}
          />

          <DragDropUploader
            label="Studio Banner / Workshop Photo"
            value={coverImageUrl}
            onChange={(url) => setCoverImageUrl(url)}
          />
        </div>
      </div>

      <div className={styles.submitRow}>
        <p className={styles.applicationNotice}>
          Submitting this form will send your application to the platform administrators for review. 
          A direct message thread will be opened for you to communicate with the team.
        </p>
        <button type="submit" disabled={loading} className={styles.submitBtn}>
          {loading ? "Submitting Application..." : existingProfile ? "Update Application" : "Submit Creator Application"}
        </button>
      </div>
    </form>
  );
}
