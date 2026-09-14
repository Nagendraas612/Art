"use client";

import Link from "next/link";
import { useSession } from "@/lib/auth-client";
import { CartNavButton } from "@/components/ui/CartNavButton";
import { SearchBar } from "@/components/ui/SearchBar";
import { NotificationBell } from "@/components/ui/NotificationBell";
import { AvatarDropdown } from "@/components/ui/AvatarDropdown";
import styles from "./Nav.module.css";

export function Nav() {
  const { data: session } = useSession();
  const user = session?.user as { id: string; name: string; email: string; image?: string | null; role?: string } | undefined;
  return (
    <nav className={styles.nav}>
      <div className={styles.inner}>
        <div className={styles.brandGroup}>
          <Link href="/" className={styles.mark}>
            Atelier &amp; Co.
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
    </nav>
  );
}
