import { prisma } from "@/lib/prisma";
import {
  DEFAULT_SHIPPING_SETTINGS,
  type ShippingSettingsData,
} from "./shipping-shared";

/**
 * Live shipping settings for the storefront and checkout.
 * Reads the singleton `ShippingSettings` row; falls back to the documented
 * defaults only if the row has not been seeded yet (fresh deploy).
 */
export async function getShippingSettings(): Promise<ShippingSettingsData> {
  const row = await prisma.shippingSettings.findUnique({
    where: { id: "default" },
    select: { flatFee: true, freeThreshold: true, defaultPickupPincode: true },
  });
  if (!row) return DEFAULT_SHIPPING_SETTINGS;
  return {
    flatFee: Number(row.flatFee),
    freeThreshold: Number(row.freeThreshold),
    defaultPickupPincode: row.defaultPickupPincode,
  };
}
