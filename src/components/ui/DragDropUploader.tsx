"use client";

import { useState, useRef, useEffect } from "react";
import styles from "./DragDropUploader.module.css";

interface DragDropUploaderProps {
  label: string;
  value: string;
  onChange: (url: string) => void;
}

export function DragDropUploader({ label, value, onChange }: DragDropUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync external value
  useEffect(() => {
    if (value) {
      setLocalPreview(null);
    }
  }, [value]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragging(true);
    } else if (e.type === "dragleave") {
      setIsDragging(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await handleUpload(e.dataTransfer.files[0]);
    }
  };

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await handleUpload(e.target.files[0]);
    }
  };

  const handleUpload = async (file: File) => {
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file (JPEG, PNG, WebP).");
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setError("Image size exceeds 8MB limit. Please choose a smaller photo.");
      return;
    }

    // Instant local preview for immediate visual feedback
    const previewUrl = URL.createObjectURL(file);
    setLocalPreview(previewUrl);
    setIsUploading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to upload image");
      }

      if (data.url) {
        onChange(data.url);
      }
    } catch (err: any) {
      setError(err.message || "An error occurred during upload.");
      setLocalPreview(null);
    } finally {
      setIsUploading(false);
    }
  };

  const displayImage = localPreview || value;

  return (
    <div className={styles.container}>
      <label className={styles.label}>{label}</label>
      <div
        className={`${styles.dropzone} ${isDragging ? styles.dragging : ""} ${error ? styles.hasError : ""}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleChange}
          accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
          className={styles.fileInput}
        />
        
        {displayImage ? (
          <div className={styles.previewContainer}>
            {/* Standard responsive img for flawless Base64 / CDN display */}
            <img
              src={displayImage}
              alt={label}
              className={styles.previewImage}
              onError={() => {
                setLocalPreview(null);
              }}
            />
            <div className={styles.previewOverlay}>
              <span>{isUploading ? "Uploading image..." : "Click or drag to replace"}</span>
            </div>
          </div>
        ) : (
          <div className={styles.placeholder}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={styles.icon}>
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
            <p className={styles.placeholderText}>
              {isUploading ? "Uploading image..." : "Drag & drop an image here, or click to browse"}
            </p>
          </div>
        )}
      </div>
      {error && <p className={styles.errorMessage}>{error}</p>}
    </div>
  );
}

