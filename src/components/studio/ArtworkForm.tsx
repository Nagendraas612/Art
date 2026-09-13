"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArtworkProductType, ArtworkStatus } from "@prisma/client";
import { createArtworkAction, updateArtworkAction, deleteArtworkAction } from "@/app/actions/studio";
import styles from "./ArtworkForm.module.css";

interface CategoryOption {
  id: string;
  name: string;
}

interface ArtworkFormProps {
  categories: CategoryOption[];
  initialData?: {
    id: string;
    title: string;
    categoryId: string;
    productType: ArtworkProductType;
    status: ArtworkStatus;
    price: number;
    description: string;
    stock: number;
    editionSize?: number | null;
    widthCm?: number | null;
    heightCm?: number | null;
    depthCm?: number | null;
    weightGrams?: number | null;
    isSigned: boolean;
    hasCertificate: boolean;
    provenanceNote?: string | null;
    isFragile: boolean;
    processingDays?: number | null;
    specifications?: Record<string, any>;
    images?: Array<{ url: string; kind: string }>;
  };
}

export function ArtworkForm({ categories, initialData }: ArtworkFormProps) {
  const router = useRouter();
  const isEdit = Boolean(initialData);

  const [formData, setFormData] = useState({
    title: initialData?.title || "",
    categoryId: initialData?.categoryId || categories[0]?.id || "",
    productType: initialData?.productType || ArtworkProductType.ORIGINAL,
    status: initialData?.status || ArtworkStatus.PUBLISHED,
    price: initialData?.price || "",
    description: initialData?.description || "",
    stock: initialData?.stock !== undefined ? initialData.stock : 1,
    editionSize: initialData?.editionSize || "",
    // Craft Specs
    medium: initialData?.specifications?.medium || "",
    surface: initialData?.specifications?.surface || "",
    clayBody: initialData?.specifications?.clayBody || "",
    glaze: initialData?.specifications?.glaze || "",
    timber: initialData?.specifications?.timber || "",
    fibers: initialData?.specifications?.fibers || "",
    paper: initialData?.specifications?.paper || "",
    printingMethod: initialData?.specifications?.printingMethod || "",
    // Dimensions
    widthCm: initialData?.widthCm || "",
    heightCm: initialData?.heightCm || "",
    depthCm: initialData?.depthCm || "",
    weightGrams: initialData?.weightGrams || "",
    // Authenticity & Shipping
    isSigned: initialData?.isSigned ?? true,
    hasCertificate: initialData?.hasCertificate ?? true,
    provenanceNote: initialData?.provenanceNote || "",
    isFragile: initialData?.isFragile ?? false,
    processingDays: initialData?.processingDays || 3,
    // Images
    primaryImageUrl: initialData?.images?.[0]?.url || "",
    galleryImageUrls: initialData?.images?.slice(1).map((i) => i.url).join("\n") || "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, isPrimary: boolean) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setErrorMessage(null);

    try {
      const data = new FormData();
      data.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: data,
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        setErrorMessage(json.error || "Failed to upload image file.");
      } else {
        if (isPrimary) {
          setFormData((prev) => ({ ...prev, primaryImageUrl: json.url }));
        } else {
          setFormData((prev) => ({
            ...prev,
            galleryImageUrls: prev.galleryImageUrls
              ? `${prev.galleryImageUrls}\n${json.url}`
              : json.url,
          }));
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Network error during upload.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    if (type === "checkbox") {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!formData.title || !formData.categoryId || !formData.price || !formData.description || !formData.primaryImageUrl) {
      setErrorMessage("Please fill in all mandatory fields (Title, Category, Price, Description, Primary Image).");
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        title: formData.title,
        categoryId: formData.categoryId,
        productType: formData.productType as ArtworkProductType,
        price: parseFloat(formData.price.toString()),
        description: formData.description,
        stock: parseInt(formData.stock.toString(), 10) || 1,
        editionSize: formData.editionSize ? parseInt(formData.editionSize.toString(), 10) : undefined,
        medium: formData.medium || undefined,
        surface: formData.surface || undefined,
        clayBody: formData.clayBody || undefined,
        glaze: formData.glaze || undefined,
        timber: formData.timber || undefined,
        fibers: formData.fibers || undefined,
        paper: formData.paper || undefined,
        printingMethod: formData.printingMethod || undefined,
        widthCm: formData.widthCm ? parseFloat(formData.widthCm.toString()) : undefined,
        heightCm: formData.heightCm ? parseFloat(formData.heightCm.toString()) : undefined,
        depthCm: formData.depthCm ? parseFloat(formData.depthCm.toString()) : undefined,
        weightGrams: formData.weightGrams ? parseInt(formData.weightGrams.toString(), 10) : undefined,
        isSigned: formData.isSigned,
        hasCertificate: formData.hasCertificate,
        provenanceNote: formData.provenanceNote || undefined,
        isFragile: formData.isFragile,
        processingDays: parseInt(formData.processingDays.toString(), 10) || 3,
        primaryImageUrl: formData.primaryImageUrl,
        galleryImageUrls: formData.galleryImageUrls
          ? formData.galleryImageUrls.split("\n").map((u) => u.trim()).filter(Boolean)
          : [],
      };

      if (isEdit && initialData?.id) {
        const res = await updateArtworkAction(initialData.id, payload);
        if (res.error) {
          setErrorMessage(res.error);
          setIsSubmitting(false);
          return;
        }
        router.push("/studio/artworks");
      } else {
        const res = await createArtworkAction(payload);
        if (res.error) {
          setErrorMessage(res.error);
          setIsSubmitting(false);
          return;
        }
        router.push("/studio/artworks");
      }
    } catch (err: any) {
      console.error("Artwork save error:", err);
      setErrorMessage(err.message || "Failed to save artwork.");
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!initialData?.id) return;
    if (!confirm("Are you sure you want to remove/archive this artwork?")) return;

    setIsSubmitting(true);
    const res = await deleteArtworkAction(initialData.id);
    if (res.error) {
      setErrorMessage(res.error);
      setIsSubmitting(false);
    } else {
      router.push("/studio/artworks");
    }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      {errorMessage && <div className={styles.errorAlert}>{errorMessage}</div>}

      {/* Section 1: Overview & Type */}
      <div className={styles.card}>
        <h2 className={styles.sectionHeading}>Piece Essentials</h2>
        <div className={styles.grid}>
          <div className={styles.colFull}>
            <label htmlFor="title">Artwork Title *</label>
            <input
              type="text"
              id="title"
              name="title"
              required
              placeholder="e.g. Whispers of Indigo Mist"
              value={formData.title}
              onChange={handleChange}
            />
          </div>

          <div>
            <label htmlFor="categoryId">Curated Category *</label>
            <select
              id="categoryId"
              name="categoryId"
              required
              value={formData.categoryId}
              onChange={handleChange}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="productType">Edition / Type *</label>
            <select
              id="productType"
              name="productType"
              required
              value={formData.productType}
              onChange={handleChange}
            >
              <option value={ArtworkProductType.ORIGINAL}>Unique 1/1 Original</option>
              <option value={ArtworkProductType.LIMITED_EDITION}>Limited Edition</option>
              <option value={ArtworkProductType.OPEN_EDITION}>Open Edition</option>
              <option value={ArtworkProductType.MADE_TO_ORDER}>Made to Order</option>
            </select>
          </div>

          <div>
            <label htmlFor="price">Price (INR ₹) *</label>
            <input
              type="number"
              id="price"
              name="price"
              required
              min="100"
              step="50"
              placeholder="e.g. 24000"
              value={formData.price}
              onChange={handleChange}
            />
          </div>

          {formData.productType !== ArtworkProductType.ORIGINAL && (
            <>
              <div>
                <label htmlFor="stock">Inventory Stock</label>
                <input
                  type="number"
                  id="stock"
                  name="stock"
                  min="0"
                  value={formData.stock}
                  onChange={handleChange}
                />
              </div>

              {formData.productType === ArtworkProductType.LIMITED_EDITION && (
                <div>
                  <label htmlFor="editionSize">Total Edition Size</label>
                  <input
                    type="number"
                    id="editionSize"
                    name="editionSize"
                    placeholder="e.g. 50"
                    value={formData.editionSize}
                    onChange={handleChange}
                  />
                </div>
              )}
            </>
          )}

          <div className={styles.colFull}>
            <label htmlFor="description">Artisanal Narrative &amp; Description *</label>
            <textarea
              id="description"
              name="description"
              rows={4}
              required
              placeholder="Describe the conceptual background, technique, materials, and emotional resonance of this work..."
              value={formData.description}
              onChange={handleChange}
            />
          </div>
        </div>
      </div>

      {/* Section 2: Craft & Physical Specifications */}
      <div className={styles.card}>
        <h2 className={styles.sectionHeading}>Craft &amp; Material Specifications</h2>
        <div className={styles.grid}>
          <div>
            <label htmlFor="medium">Primary Medium</label>
            <input
              type="text"
              id="medium"
              name="medium"
              placeholder="e.g. Oil on Canvas, High-Fire Ceramic"
              value={formData.medium}
              onChange={handleChange}
            />
          </div>

          <div>
            <label htmlFor="surface">Surface / Base</label>
            <input
              type="text"
              id="surface"
              name="surface"
              placeholder="e.g. Stretched Belgian Linen, Teak Board"
              value={formData.surface}
              onChange={handleChange}
            />
          </div>

          <div>
            <label htmlFor="clayBody">Clay Body / Glaze (Ceramics)</label>
            <input
              type="text"
              id="clayBody"
              name="clayBody"
              placeholder="e.g. Iron-rich stoneware, Celadon glaze"
              value={formData.clayBody}
              onChange={handleChange}
            />
          </div>

          <div>
            <label htmlFor="timber">Timber Species (Woodwork)</label>
            <input
              type="text"
              id="timber"
              name="timber"
              placeholder="e.g. Black Walnut, Reclaimed Rosewood"
              value={formData.timber}
              onChange={handleChange}
            />
          </div>

          <div>
            <label htmlFor="fibers">Fibers &amp; Dyes (Textiles)</label>
            <input
              type="text"
              id="fibers"
              name="fibers"
              placeholder="e.g. Hand-spun tussar silk, Indigo dye"
              value={formData.fibers}
              onChange={handleChange}
            />
          </div>

          <div>
            <label htmlFor="paper">Archival Paper &amp; Printing</label>
            <input
              type="text"
              id="paper"
              name="paper"
              placeholder="e.g. 310gsm Hahnemühle Rag, Linocut print"
              value={formData.paper}
              onChange={handleChange}
            />
          </div>
        </div>

        <h3 className={styles.subHeading}>Physical Dimensions &amp; Weight</h3>
        <div className={styles.gridFour}>
          <div>
            <label htmlFor="heightCm">Height (cm)</label>
            <input
              type="number"
              id="heightCm"
              name="heightCm"
              step="0.5"
              placeholder="e.g. 60"
              value={formData.heightCm}
              onChange={handleChange}
            />
          </div>

          <div>
            <label htmlFor="widthCm">Width (cm)</label>
            <input
              type="number"
              id="widthCm"
              name="widthCm"
              step="0.5"
              placeholder="e.g. 45"
              value={formData.widthCm}
              onChange={handleChange}
            />
          </div>

          <div>
            <label htmlFor="depthCm">Depth (cm)</label>
            <input
              type="number"
              id="depthCm"
              name="depthCm"
              step="0.5"
              placeholder="e.g. 5"
              value={formData.depthCm}
              onChange={handleChange}
            />
          </div>

          <div>
            <label htmlFor="weightGrams">Weight (Grams)</label>
            <input
              type="number"
              id="weightGrams"
              name="weightGrams"
              placeholder="e.g. 1500"
              value={formData.weightGrams}
              onChange={handleChange}
            />
          </div>
        </div>
      </div>

      {/* Section 3: Visual Imagery */}
      <div className={styles.card}>
        <h2 className={styles.sectionHeading}>Imagery &amp; Portfolio Photos</h2>
        <div className={styles.grid}>
          <div className={styles.colFull}>
            <label htmlFor="primaryImageUrl">Primary Cover Image *</label>
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <input
                type="url"
                id="primaryImageUrl"
                name="primaryImageUrl"
                required
                placeholder="https://images.unsplash.com/photo-... or upload from disk"
                value={formData.primaryImageUrl}
                onChange={handleChange}
                style={{ flex: 1 }}
              />
              <label
                style={{
                  cursor: isUploading ? "not-allowed" : "pointer",
                  padding: "10px 16px",
                  background: "#f5f5f4",
                  border: "1px solid #d6d3d1",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                {isUploading ? "Uploading..." : "📁 Upload File"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/avif"
                  disabled={isUploading}
                  style={{ display: "none" }}
                  onChange={(e) => handleFileUpload(e, true)}
                />
              </label>
            </div>
          </div>

          {formData.primaryImageUrl && (
            <div className={styles.previewBox}>
              <span className={styles.previewLabel}>Primary Photo Preview</span>
              <div className={styles.previewThumb}>
                <img src={formData.primaryImageUrl} alt="Primary Preview" />
              </div>
            </div>
          )}

          <div className={styles.colFull}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
              <label htmlFor="galleryImageUrls" style={{ margin: 0 }}>
                Additional Gallery Photos (One per line or upload files)
              </label>
              <label
                style={{
                  cursor: isUploading ? "not-allowed" : "pointer",
                  padding: "4px 12px",
                  background: "#f5f5f4",
                  border: "1px solid #d6d3d1",
                  borderRadius: "6px",
                  fontSize: "12px",
                  fontWeight: 600,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                + Add Photo File
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/avif"
                  disabled={isUploading}
                  style={{ display: "none" }}
                  onChange={(e) => handleFileUpload(e, false)}
                />
              </label>
            </div>
            <textarea
              id="galleryImageUrls"
              name="galleryImageUrls"
              rows={3}
              placeholder="https://images.unsplash.com/photo-1&#10;/uploads/artworks/photo-2.jpg"
              value={formData.galleryImageUrls}
              onChange={handleChange}
            />
          </div>
        </div>
      </div>

      {/* Section 4: Authenticity & Logistics */}
      <div className={styles.card}>
        <h2 className={styles.sectionHeading}>Authenticity &amp; Studio Logistics</h2>
        <div className={styles.checkboxGrid}>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              name="isSigned"
              checked={formData.isSigned}
              onChange={handleChange}
            />
            <div>
              <strong>Hand-signed by Artist</strong>
              <p>Physical signature or artist mark on the artwork</p>
            </div>
          </label>

          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              name="hasCertificate"
              checked={formData.hasCertificate}
              onChange={handleChange}
            />
            <div>
              <strong>Certificate of Authenticity</strong>
              <p>Generate serial-numbered COA for collector provenance</p>
            </div>
          </label>

          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              name="isFragile"
              checked={formData.isFragile}
              onChange={handleChange}
            />
            <div>
              <strong>Fragile Care Required</strong>
              <p>Requires custom wooden crate or double-layered bubble insulation</p>
            </div>
          </label>
        </div>

        <div className={styles.grid} style={{ marginTop: "20px" }}>
          <div>
            <label htmlFor="processingDays">Studio Processing Days</label>
            <input
              type="number"
              id="processingDays"
              name="processingDays"
              min="1"
              max="30"
              value={formData.processingDays}
              onChange={handleChange}
            />
          </div>

          <div>
            <label htmlFor="provenanceNote">Provenance &amp; Studio Notes</label>
            <input
              type="text"
              id="provenanceNote"
              name="provenanceNote"
              placeholder="e.g. Created in artist's monsoon 2026 collection"
              value={formData.provenanceNote}
              onChange={handleChange}
            />
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className={styles.actionsFooter}>
        {isEdit && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={isSubmitting}
            className={styles.deleteBtn}
          >
            Archive Piece
          </button>
        )}

        <div className={styles.rightActions}>
          <Link href="/studio/artworks" className={styles.cancelBtn}>
            Cancel
          </Link>

          <button
            type="submit"
            disabled={isSubmitting}
            className={styles.submitBtn}
          >
            {isSubmitting ? (
              <span>Publishing...</span>
            ) : isEdit ? (
              <span>Save Changes</span>
            ) : (
              <span>Publish Artwork to Marketplace &rarr;</span>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
