/**
 * Shared shipping-fee logic — client-safe (no Prisma import).
 * The authoritative values live in the `ShippingSettings` DB row and are
 * edited from /admin/shipping. Nothing below is a business decision; the
 * DEFAULT_* constants are only a safety net for the brief window between a
 * fresh deploy and the seed script creating the DB row.
 */

export interface ShippingSettingsData {
  flatFee: number;
  freeThreshold: number;
  /** Fallback pickup pincode for live courier rating (admin-set). */
  defaultPickupPincode?: string | null;
}

/** Last-resort fallback. The seed script + admin page own the real values. */
export const DEFAULT_SHIPPING_SETTINGS: ShippingSettingsData = {
  flatFee: 500,
  freeThreshold: 10000,
};

/**
 * Insured-logistics fee for a given artwork subtotal.
 * - Empty bag → ₹0
 * - Subtotal above the free-shipping threshold → ₹0 ("Complimentary")
 * - Otherwise → the configured flat fee
 */
export function calculateShippingFee(
  subtotal: number,
  settings: ShippingSettingsData,
): number {
  if (subtotal <= 0) return 0;
  return subtotal > settings.freeThreshold ? 0 : settings.flatFee;
}

export function formatShippingFee(
  fee: number,
  formatter: (n: number) => string,
): string {
  return fee === 0 ? "Complimentary" : formatter(fee);
}
