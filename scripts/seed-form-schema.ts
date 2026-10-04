/**
 * Seeds the admin-manageable artwork form schema.
 *
 * - Upserts ArtworkFormField rows from the static registry
 *   (src/lib/artwork-form-config.ts). Safe to re-run: existing admin
 *   customizations (labels, required, visibility, order) are preserved.
 * - Upserts the four system-locked edition options.
 * - Harvests distinct specification values already stored on artworks
 *   (medium, surface, clayBody, timber, fibers, paper) into dropdown
 *   options, so converting those fields to dropdowns loses nothing.
 *
 * Run after `npx prisma db push`:
 *   npx tsx scripts/seed-form-schema.ts
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import {
  FORM_FIELD_REGISTRY,
  PRODUCT_TYPE_OPTIONS,
} from "../src/lib/artwork-form-config";

// Prisma 7 requires a driver adapter; mirrors src/lib/prisma.ts.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

const SPEC_KEYS = ["medium", "surface", "clayBody", "timber", "fibers", "paper"] as const;

async function main() {
  // 1. Field definitions (upsert — never clobbers admin edits).
  for (const def of FORM_FIELD_REGISTRY) {
    await prisma.artworkFormField.upsert({
      where: { key: def.key },
      create: {
        key: def.key,
        label: def.defaultLabel,
        section: def.section,
        inputType: def.inputType,
        required: def.defaultRequired,
        visible: def.defaultVisible,
        position: def.defaultPosition,
        systemLocked: def.systemLocked,
      },
      update: {
        // Keep code and DB in sync for structural facts; never touch
        // label/required/visible/position (admin-owned).
        section: def.section,
        systemLocked: def.systemLocked,
      },
    });
  }
  console.log(`Upserted ${FORM_FIELD_REGISTRY.length} field definitions.`);

  // 2. Edition options (system-locked values, admin-editable labels).
  const editionField = await prisma.artworkFormField.findUnique({
    where: { key: "productType" },
  });
  if (editionField) {
    for (const [i, opt] of PRODUCT_TYPE_OPTIONS.entries()) {
      await prisma.artworkFormFieldOption.upsert({
        where: { fieldId_value: { fieldId: editionField.id, value: opt.value } },
        create: {
          fieldId: editionField.id,
          label: opt.label,
          value: opt.value,
          position: i,
          isSystem: true,
        },
        update: { position: i, isSystem: true },
      });
    }
    console.log("Upserted edition options.");
  }

  // 3. Harvest distinct specification values into dropdown options.
  const artworks = await prisma.artwork.findMany({
    select: { specifications: true },
  });
  const harvested = new Map<string, Set<string>>();
  for (const key of SPEC_KEYS) harvested.set(key, new Set());
  for (const a of artworks) {
    const specs = (a.specifications || {}) as Record<string, unknown>;
    for (const key of SPEC_KEYS) {
      const v = specs[key];
      if (typeof v === "string" && v.trim()) harvested.get(key)!.add(v.trim());
    }
  }

  for (const key of SPEC_KEYS) {
    const field = await prisma.artworkFormField.findUnique({ where: { key } });
    if (!field) continue;
    const existing = await prisma.artworkFormFieldOption.findMany({
      where: { fieldId: field.id },
      orderBy: { position: "desc" },
      take: 1,
    });
    let pos = (existing[0]?.position ?? -1) + 1;
    let added = 0;
    for (const label of [...harvested.get(key)!].sort()) {
      const value = slugify(label);
      if (!value) continue;
      const clash = await prisma.artworkFormFieldOption.findUnique({
        where: { fieldId_value: { fieldId: field.id, value } },
      });
      if (clash) continue;
      await prisma.artworkFormFieldOption.create({
        data: { fieldId: field.id, label, value, position: pos++ },
      });
      added++;
    }
    console.log(`Field "${key}": added ${added} harvested options.`);
  }

  console.log("Form schema seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
