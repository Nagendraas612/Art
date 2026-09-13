"use client";

import { useState, useRef, useEffect, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { searchArtworksAction } from "@/app/actions/search";
import styles from "./SearchBar.module.css";

export function SearchBar() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const timer = setTimeout(() => {
      startTransition(async () => {
        const res = await searchArtworksAction({ query: query.trim() });
        setResults(res.artworks.slice(0, 5) || []);
      });
    }, 300); // 300ms debounce
    return () => clearTimeout(timer);
  }, [query]);

  // Keyboard shortcut: Ctrl+K / Cmd+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
        setQuery("");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  // Click outside to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (query.trim()) {
        router.push(`/explore?q=${encodeURIComponent(query.trim())}`);
        setOpen(false);
      }
    },
    [query, router]
  );

  return (
    <div ref={wrapRef} className={styles.wrap}>
      {!open ? (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setTimeout(() => inputRef.current?.focus(), 50);
          }}
          className={styles.trigger}
          aria-label="Search artworks"
          title="Search (Ctrl+K)"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </button>
      ) : (
        <form onSubmit={handleSubmit} className={styles.form}>
          <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search artworks, artists, mediums…"
            className={styles.input}
            autoComplete="off"
          />
          {query && (
            <button
              type="button"
              onClick={() => { setQuery(""); inputRef.current?.focus(); }}
              className={styles.clearBtn}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
          <kbd className={styles.kbd}>Esc</kbd>
        </form>
      )}

      {/* Live Search Results Dropdown */}
      {open && query.trim() && (
        <div className={styles.dropdown}>
          {isPending ? (
            <div className={styles.loading}>Searching...</div>
          ) : results.length > 0 ? (
            <ul className={styles.resultList}>
              {results.map((art) => (
                <li key={art.id}>
                  <Link href={`/artwork/${art.slug}`} className={styles.resultItem} onClick={() => setOpen(false)}>
                    {art.images?.[0] && (
                      <div className={styles.resultImgWrap}>
                        <Image src={art.images[0].url} alt={art.title} fill className={styles.resultImg} />
                      </div>
                    )}
                    <div className={styles.resultInfo}>
                      <span className={styles.resultTitle}>{art.title}</span>
                      <span className={styles.resultCreator}>{art.creator.storeName}</span>
                    </div>
                  </Link>
                </li>
              ))}
              <li className={styles.viewAll}>
                <Link href={`/explore?q=${encodeURIComponent(query.trim())}`} onClick={() => setOpen(false)}>
                  View all results &rarr;
                </Link>
              </li>
            </ul>
          ) : (
            <div className={styles.noResults}>No matches found.</div>
          )}
        </div>
      )}
    </div>
  );
}
