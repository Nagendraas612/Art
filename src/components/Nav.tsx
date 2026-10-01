"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "@/lib/auth-client";
import { CartNavButton } from "@/components/ui/CartNavButton";
import { SearchBar } from "@/components/ui/SearchBar";
import { NotificationBell } from "@/components/ui/NotificationBell";
import { AvatarDropdown } from "@/components/ui/AvatarDropdown";
import styles from "./Nav.module.css";

export function Nav() {
  const { data: session } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const user = session?.user as { id: string; name: string; email: string; image?: string | null; role?: string } | undefined;

  return (
    <nav className={styles.nav}>
      <div className={styles.inner}>
        <div className={styles.brandGroup}>
          <button
            className={styles.hamburgerBtn}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle Navigation Menu"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {mobileMenuOpen ? (
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
              ) : (
                <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" strokeLinejoin="round" />
              )}
            </svg>
          </button>

          <Link href="/" className={styles.mark}>
            <img src="/KaalaBhadraLogoCropped.png" alt="Kaala Bhadra Emblem" className={styles.logoBadge} />
            <span>Kaala Bhadra</span>
          </Link>

          <ul className={styles.links}>
            <li>
              <Link href="/explore">Explore</Link>
            </li>
            <li>
              <Link href="/creators">Creators</Link>
            </li>
            <li>
              <Link href="/orders">Orders</Link>
            </li>
            {!user && (
              <li>
                <Link href="/become-a-creator">Become a Creator</Link>
              </li>
            )}
          </ul>
        </div>

        <div className={styles.actions}>
          <SearchBar />

          {user ? (
            <>
              <Link
                href="/wishlist"
                className={styles.iconBtn}
                aria-label="Saved Collection"
                title="Saved Collection"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
              </Link>

              <NotificationBell />

              <CartNavButton />

              <AvatarDropdown user={user as any} />
            </>
          ) : (
            <>
              <Link href="/sign-in" className={styles.link}>
                Sign in
              </Link>
              <Link href="/sign-up" className={styles.btnPrimary}>
                Get Started
              </Link>
            </>
          )}
        </div>
      </div>

      {mobileMenuOpen && (
        <div className={styles.mobileDrawer}>
          <ul className={styles.mobileLinks}>
            <li>
              <Link href="/explore" onClick={() => setMobileMenuOpen(false)}>
                Explore Gallery
              </Link>
            </li>
            <li>
              <Link href="/creators" onClick={() => setMobileMenuOpen(false)}>
                Master Creators
              </Link>
            </li>
            <li>
              <Link href="/orders" onClick={() => setMobileMenuOpen(false)}>
                Order History
              </Link>
            </li>
            {user ? (
              <>
                <li>
                  <Link href="/wishlist" onClick={() => setMobileMenuOpen(false)}>
                    Saved Collection
                  </Link>
                </li>
                {user.role === "CREATOR" || user.role === "ADMIN" ? (
                  <li>
                    <Link href="/studio/artworks" onClick={() => setMobileMenuOpen(false)}>
                      Studio Portal
                    </Link>
                  </li>
                ) : (
                  <li>
                    <Link href="/become-a-creator" onClick={() => setMobileMenuOpen(false)}>
                      Become a Creator
                    </Link>
                  </li>
                )}
              </>
            ) : (
              <>
                <li>
                  <Link href="/become-a-creator" onClick={() => setMobileMenuOpen(false)}>
                    Become a Creator
                  </Link>
                </li>
                <li>
                  <Link href="/sign-in" onClick={() => setMobileMenuOpen(false)}>
                    Sign In
                  </Link>
                </li>
              </>
            )}
          </ul>
        </div>
      )}
    </nav>
  );
}
