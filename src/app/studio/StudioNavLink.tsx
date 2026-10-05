"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./studio.module.css";

interface StudioNavLinkProps {
  href: string;
  exact?: boolean;
  children: React.ReactNode;
}

/** A studio sidebar link that highlights when its section is active. */
export function StudioNavLink({ href, exact, children }: StudioNavLinkProps) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname.startsWith(href);
  return (
    <Link
      href={href}
      className={`${styles.navLink} ${active ? styles.navLinkActive : ""}`}
      aria-current={active ? "page" : undefined}
    >
      {children}
    </Link>
  );
}
