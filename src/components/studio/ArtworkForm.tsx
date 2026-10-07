"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArtworkProductType, ArtworkStatus } from "@prisma/client";
import { createArtworkAction, updateArtworkAction, deleteArtworkAction } from "@/app/actions/studio";
import type { ArtworkFormConfig, ResolvedFormField } from "@/lib/form-schema";
import styles from "./ArtworkForm.module.css";

interface ArtworkFormProps {
  formConfig: ArtworkFormConfig;
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

export function ArtworkForm({ formConfig, initialData }: ArtworkFormProps) {
  const router = useRouter();
  const isEdit = Boolean(initialData);

  const fieldsByKey = React.useMemo(() => {
    const map = new Map<string, ResolvedFormField>();
    for (const s of formConfig.sections) for (const f of s.fields) map.set(f.key, f);
    return map;
  }, [formConfig]);

  const fieldLabel = (key: string) => fieldsByKey.get(key)?.label || key;

  const [formData, setFormData] = useState({
    title: initialData?.title || "",
    categoryId: initialData?.categoryId || formConfig.categories[0]?.id || "",
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

    // Mandatory fields come from the admin-managed form schema.
    const missing = formConfig.requiredKeys.filter((k) => {
      const v = (formData as Record<string, any>)[k];
      return v === "" || v === undefined || v === null;
    });
    const missingLabels = missing.map(fieldLabel);
    if (!formData.primaryImageUrl) missingLabels.push("Primary Image");
    if (missingLabels.length > 0) {
      setErrorMessage(
        `Please fill in all mandatory fields: ${missingLabels.join(", ")}.`
      );
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
        stock: Math.max(0, parseInt(formData.stock.toString(), 10) || 0),
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
        router.push("/studio/artworks?saved=1");
      } else {
        const res = await createArtworkAction(payload);
        if (res.error) {
          setErrorMessage(res.error);
          setIsSubmitting(false);
          return;
        }
        // The submit lands on the list with no feedback — the creator can't
        // tell it worked. Carry a flag so the list can confirm.
        router.push("/studio/artworks?submitted=1");
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

  /** Render one schema-managed field by its admin-configured input type. */
  const renderField = (field: ResolvedFormField) => {
    const rawValue = (formData as Record<string, any>)[field.key];
    const value = rawValue ?? "";
    const wide = field.key === "title" || field.key === "description" || field.inputType === "textarea";

    let input: React.ReactNode = null;
    if (field.inputType === "select") {
      const opts = [...field.options];
      // If the stored value is no longer among the options (e.g. admin
      // removed it), keep it visible so edits don't silently wipe data.
      if (value && !opts.some((o) => String(o.value) === String(value))) {
        opts.unshift({ id: `__current_${field.key}`, label: String(value), value: String(value), isSystem: false });
      }
      const showEmpty = field.key !== "productType" && field.key !== "categoryId";
      input = (
        <select
          id={field.key}
          name={field.key}
          required={field.required}
          value={String(value)}
          onChange={handleChange}
        >
          {showEmpty && <option value="">— Select —</option>}
          {opts.map((o) => (
            <option key={o.id} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
    } else if (field.inputType === "textarea") {
      input = (
        <textarea
          id={field.key}
          name={field.key}
          rows={4}
          required={field.required}
          placeholder={field.placeholder}
          value={String(value)}
          onChange={handleChange}
        />
      );
    } else if (field.inputType === "price") {
      input = (
        <input
          type="number"
          id={field.key}
          name={field.key}
          required={field.required}
          min="1"
          step="1"
          placeholder={field.placeholder}
          value={value as any}
          onChange={handleChange}
        />
      );
    } else if (field.inputType === "number") {
      input = (
        <input
          type="number"
          id={field.key}
          name={field.key}
          required={field.required}
          min="0"
          step={field.key === "weightGrams" ? "1" : "0.5"}
          placeholder={field.placeholder}
          value={value as any}
          onChange={handleChange}
        />
      );
    } else {
      input = (
        <input
          type="text"
          id={field.key}
          name={field.key}
          required={field.required}
          placeholder={field.placeholder}
          value={String(value)}
          onChange={handleChange}
        />
      );
    }

    return (
      <div key={field.key} className={wide ? styles.colFull : undefined}>
        <label htmlFor={field.key}>
          {field.label}
          {field.required && " *"}
        </label>
        {input}
      </div>
    );
  };

  const essentials = formConfig.sections.find((s) => s.key === "essentials")?.fields || [];
  const craft = formConfig.sections.find((s) => s.key === "craft")?.fields || [];
  const dimensions = formConfig.sections.find((s) => s.key === "dimensions")?.fields || [];

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      {errorMessage && <div className={styles.errorAlert}>{errorMessage}</div>}

      {/* Section 1: Piece Essentials */}
      <div className={styles.card}>
        <h2 className={styles.sectionHeading}>Piece Essentials</h2>
        <div className={styles.grid}>
          {essentials.map((f) => (
            <React.Fragment key={f.key}>
              {renderField(f)}
              {f.key === "productType" && formData.productType !== ArtworkProductType.ORIGINAL && (
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
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Section 2: Craft & Material Specifications */}
      <div className={styles.card}>
        <h2 className={styles.sectionHeading}>Craft &amp; Material Specifications</h2>
        <div className={styles.grid}>{craft.map(renderField)}</div>

        <h3 className={styles.subHeading}>Physical Dimensions &amp; Weight</h3>
        <div className={styles.gridFour}>{dimensions.map(renderField)}</div>
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
              {formData.primaryImageUrl && (
                <button
                  type="button"
                  onClick={() => setFormData((p) => ({ ...p, primaryImageUrl: "" }))}
                  style={{
                    padding: "10px 14px",
                    background: "transparent",
                    border: "1px solid #e7c1c1",
                    borderRadius: "8px",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "#a32626",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                  title="Remove this image"
                >
                  ✕ Clear
                </button>
              )}
            </div>
          </div>

          {formData.primaryImageUrl && (
            <div className={styles.previewBox}>
              <span className={styles.previewLabel}>Primary Photo Preview</span>
              {formData.primaryImageUrl.includes("unsplash.com") && (
                <div
                  style={{
                    background: "#FFFBEB",
                    border: "1px solid #FCD34D",
                    borderRadius: "6px",
                    padding: "10px 14px",
                    marginBottom: "12px",
                    color: "#92400E",
                    fontSize: "13px",
                    lineHeight: "1.5",
                  }}
                >
                  <strong>⚠️ Unverified External / Stock Photo URL Detected</strong>
                  <p style={{ margin: "4px 0 0" }}>
                    This artwork is currently referencing an external stock photo. Buyers trust real photos — please upload an actual photo of your piece.
                  </p>
                </div>
              )}
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
              <p>Generate a numbered certificate of authenticity</p>
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
            <label htmlFor="provenanceNote">History &amp; Studio Notes</label>
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
              <span>Submitting...</span>
            ) : isEdit ? (
              <span>Save Changes</span>
            ) : (
              <span>Submit for Review &rarr;</span>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
