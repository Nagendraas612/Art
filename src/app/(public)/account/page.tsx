import React from "react";
import { getSession } from "@/modules/auth/guards";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Nav } from "@/components/Nav";
import { LogoutButton } from "./LogoutButton";
import styles from "./account.module.css";
import Link from "next/link";

export default async function AccountPage() {
  const session = await getSession();
  if (!session?.user) {
    redirect("/sign-in");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  if (!user) {
    redirect("/sign-in");
  }

  return (
    <>
      <Nav />
      <main className={styles.main}>
        <div className="wrap">
          <div className={styles.header}>
            <h1 className={styles.title}>Account Settings</h1>
          </div>

          <div className={styles.card}>
            <div className={styles.profileSection}>
              <div className={styles.avatarLarge}>
                {user.name ? user.name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
              </div>
              <div className={styles.userInfo}>
                <h2 className={styles.userName}>{user.name || "Collector"}</h2>
                <p className={styles.userEmail}>{user.email}</p>
                <div className={styles.roleBadge}>Role: {user.role}</div>
              </div>
            </div>

            <div className={styles.actions}>
              {user.role === "CREATOR" && (
                <Link href="/studio" className={styles.btnSecondary}>
                  Creator Studio
                </Link>
              )}
              {user.role === "ADMIN" && (
                <Link href="/admin" className={styles.btnSecondary}>
                  Admin Dashboard
                </Link>
              )}
              <Link href="/orders" className={styles.btnSecondary}>
                Order History
              </Link>
            </div>

            <div className={styles.dangerZone}>
              <LogoutButton />
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
