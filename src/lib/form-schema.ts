import { prisma } from "@/lib/prisma";
import {
  FORM_FIELD_REGISTRY,
  FORM_SECTIONS,
  PRODUCT_TYPE_OPTIONS,
  type FormFieldInputType,
  type FormFieldSection,
} from "@/lib/artwork-form-config";

export interface ResolvedFieldOption {
  id: string;
  label: string;
  value: string;
  isSystem: boolean;
}

export interface ResolvedFormField {
  key: string;
  section: FormFieldSection;
  inputType: FormFieldInputType;
  label: string;
  required: boolean;
  visible: boolean;
  position: number;
  systemLocked: boolean;
  placeholder?: string;
  options: ResolvedFieldOption[];
}

export interface ArtworkFormConfig {
  sections: { key: FormFieldSection; title: string; fields: ResolvedFormField[] }[];
  /** Flat list of keys the admin marked required (for server-side checks). */
  requiredKeys: string[];
  categories: { id: string; name: string }[];
}

type DbFieldRow = {
  key: string;
  label: string;
  inputType: string;
  required: boolean;
  visible: boolean;
  position: number;
  options: { id: string; label: string; value: string; position: number; isSystem: boolean }[];
};

/**
 * Resolve the artwork form configuration: static registry merged with
 * admin overrides from the DB. Falls back to registry defaults when the
 * DB has no row yet (e.g. before the seed script runs).
 */
export async function getArtworkFormConfig(): Promise<ArtworkFormConfig> {
  const [dbFields, categories] = await Promise.all([
    prisma.artworkFormField
      .findMany({ include: { options: { orderBy: { position: "asc" } } } })
      .catch(() => [] as DbFieldRow[]),
    prisma.artworkCategory
      .findMany({
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true, parentId: true, parent: { select: { name: true } } },
      })
      .catch(() => [] as { id: string; name: string; parentId: string | null; parent: { name: string } | null }[]),
  ]);

  const dbFieldMap = new Map((dbFields as DbFieldRow[]).map((f) => [f.key, f]));

  const resolved: ResolvedFormField[] = FORM_FIELD_REGISTRY.map((def) => {
    const row = dbFieldMap.get(def.key);
    const inputType = (row?.inputType as FormFieldInputType) || def.inputType;

    let options: ResolvedFieldOption[] = [];
    if (inputType === "select") {
      if (def.optionsSource === "category") {
        options = categories.map((c) => ({
          id: c.id,
          label: c.parent?.name ? `${c.parent.name} › ${c.name}` : c.name,
          value: c.id,
          isSystem: false,
        }));
      } else if (def.optionsSource === "enum-productType") {
        // Edition labels are admin-editable; values stay locked to the enum.
        const overrides = new Map((row?.options || []).map((o) => [o.value, o]));
        options = PRODUCT_TYPE_OPTIONS.map((p, i) => ({
          id: overrides.get(p.value)?.id || `system-${p.value}`,
          label: overrides.get(p.value)?.label || p.label,
          value: p.value,
          isSystem: true,
        })).sort((a, b) => {
          const pa = overrides.get(a.value)?.position ?? 1000 + PRODUCT_TYPE_OPTIONS.findIndex((p) => p.value === a.value);
          const pb = overrides.get(b.value)?.position ?? 1000 + PRODUCT_TYPE_OPTIONS.findIndex((p) => p.value === b.value);
          return pa - pb;
        });
      } else {
        options = (row?.options || []).map((o) => ({
          id: o.id,
          label: o.label,
          value: o.value,
          isSystem: o.isSystem,
        }));
      }
    }

    return {
      key: def.key,
      section: def.section,
      inputType,
      label: row?.label || def.defaultLabel,
      required: row ? row.required : def.defaultRequired,
      visible: row ? row.visible : def.defaultVisible,
      position: row ? row.position : def.defaultPosition,
      systemLocked: def.systemLocked,
      placeholder: def.placeholder,
      options,
    };
  });

  const sections = FORM_SECTIONS.map((s) => ({
    ...s,
    fields: resolved
      .filter((f) => f.section === s.key && f.visible)
      .sort((a, b) => a.position - b.position),
  }));

  return {
    sections,
    requiredKeys: resolved.filter((f) => f.required && f.visible).map((f) => f.key),
    categories: categories.map((c) => ({ id: c.id, name: c.name })),
  };
}

/**
 * Server-side enforcement of admin-configured required fields.
 * Returns an error message, or null when everything required is present.
 */
export async function checkDynamicRequired(
  data: Record<string, unknown>
): Promise<string | null> {
  const config = await getArtworkFormConfig();
  const missing = config.requiredKeys.filter((k) => {
    const v = data[k];
    return v === "" || v === undefined || v === null;
  });
  if (missing.length === 0) return null;
  const labels = missing.map(
    (k) =>
      config.sections.flatMap((s) => s.fields).find((f) => f.key === k)?.label || k
  );
  return `Please fill in all mandatory fields: ${labels.join(", ")}.`;
}
