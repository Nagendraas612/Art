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
          Buyers now see <strong>live courier rates</strong> at checkout
          (cheapest Shiprocket rate per creator pickup location). The flat fee
          below is the emergency fallback when live rates are unavailable, and
          the threshold still controls complimentary shipping. Changes apply
          instantly to the storefront — no code deploy needed.
        </p>
      </div>
      <ShippingSettingsForm
        initialFlatFee={settings.flatFee}
        initialFreeThreshold={settings.freeThreshold}
        initialDefaultPickupPincode={settings.defaultPickupPincode}
        initialDefaultPickupLocation={settings.defaultPickupLocation}
        initialUpdatedAt={settings.updatedAt}
      />
    </div>
  );
}
