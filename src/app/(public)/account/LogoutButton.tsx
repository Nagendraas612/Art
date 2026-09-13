"use client";

import { signOut } from "@/lib/auth-client";
import styles from "./account.module.css";

export function LogoutButton() {
  return (
    <button onClick={() => signOut({ callbackURL: "/" })} className={styles.btnDanger}>
      Log Out
    </button>
  );
}
