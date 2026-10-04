import { ShippingSettingsForm } from "@/components/admin/ShippingSettingsForm";
import { getShippingSettingsAction } from "@/app/actions/admin-shipping";
import styles from "./shipping.module.css";

export const dynamic = "force-dynamic";

export default async function AdminShippingPage() {
  const settings = await getShippingSettingsAction();

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Shipping Settings</h1>
        <p className={styles.subtitle}>
          Control the “Insured Logistics” line buyers see in the bag and at
          checkout. Changes apply instantly to the storefront — no code deploy
          needed.
        </p>
      </div>
      <ShippingSettingsForm
        initialFlatFee={settings.flatFee}
        initialFreeThreshold={settings.freeThreshold}
        initialUpdatedAt={settings.updatedAt}
      />
    </div>
  );
}
