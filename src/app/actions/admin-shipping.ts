"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { firstIssue } from "@/lib/validation";
import { DEFAULT_SHIPPING_SETTINGS } from "@/lib/shipping-shared";

async function requireAdmin() {
  const admin = await getCurrentAdmin();
  if (!admin) throw new Error("Unauthorized admin access");
  return admin;
}

const shippingSettingsSchema = z.object({
  flatFee: z
    .number({ error: "Flat fee must be a number" })
    .finite()
    .min(0, "Flat fee cannot be negative")
    .max(100000, "Flat fee looks unrealistically high"),
  freeThreshold: z
    .number({ error: "Free-shipping threshold must be a number" })
    .finite()
    .min(0, "Threshold cannot be negative")
    .max(100000000, "Threshold looks unrealistically high"),
});

export type ShippingSettingsInput = z.infer<typeof shippingSettingsSchema>;

export async function getShippingSettingsAction() {
  await requireAdmin();
  const row = await prisma.shippingSettings.findUnique({
    where: { id: "default" },
  });
  return {
    flatFee: row ? Number(row.flatFee) : DEFAULT_SHIPPING_SETTINGS.flatFee,
    freeThreshold: row
      ? Number(row.freeThreshold)
      : DEFAULT_SHIPPING_SETTINGS.freeThreshold,
    updatedAt: row?.updatedAt.toISOString() ?? null,
  };
}

export async function updateShippingSettingsAction(input: ShippingSettingsInput) {
  await requireAdmin();

  const parsed = shippingSettingsSchema.safeParse(input);
  if (!parsed.success) {
    // Zod messages are human-readable and safe to show the admin.
    return { ok: false as const, error: firstIssue(parsed.error) };
  }

  await prisma.shippingSettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      flatFee: parsed.data.flatFee,
      freeThreshold: parsed.data.freeThreshold,
    },
    update: {
      flatFee: parsed.data.flatFee,
      freeThreshold: parsed.data.freeThreshold,
    },
  });

  // Storefront reads live values (API route is force-dynamic, checkout
  // action reads the DB), but revalidate the admin page itself.
  revalidatePath("/admin/shipping");

  return { ok: true as const };
}
