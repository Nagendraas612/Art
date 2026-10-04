"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { cuidSchema, firstIssue, toClientError } from "@/lib/validation";
import { FORM_FIELD_REGISTRY, type FormFieldInputType } from "@/lib/artwork-form-config";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

async function requireAdmin() {
  const admin = await getCurrentAdmin();
  if (!admin) throw new Error("Unauthorized admin access");
  return admin;
}

/**
 * Full form-schema snapshot for the admin UI: every registry field merged
 * with its DB row (or defaults), plus categories with artwork counts.
 */
export async function getFormSchemaAdminAction() {
  await requireAdmin();

  const [dbFields, categories] = await Promise.all([
    prisma.artworkFormField.findMany({
      include: { options: { orderBy: { position: "asc" } } },
    }),
    prisma.artworkCategory.findMany({
      include: { _count: { select: { artworks: true, children: true } } },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  const dbMap = new Map(dbFields.map((f) => [f.key, f]));

  const fields = FORM_FIELD_REGISTRY.map((def) => {
    const row = dbMap.get(def.key);
    return {
      key: def.key,
      section: def.section,
      inputType: row?.inputType || def.inputType,
      allowedInputTypes: def.allowedInputTypes || [],
      label: row?.label || def.defaultLabel,
      required: row ? row.required : def.defaultRequired,
      visible: row ? row.visible : def.defaultVisible,
      position: row ? row.position : def.defaultPosition,
      systemLocked: def.systemLocked,
      optionsSource: def.optionsSource || null,
      options: (row?.options || []).map((o) => ({
        id: o.id,
        label: o.label,
        value: o.value,
        position: o.position,
        isSystem: o.isSystem,
      })),
    };
  }).sort((a, b) => a.position - b.position);

  return {
    fields,
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      isActive: c.isActive,
      sortOrder: c.sortOrder,
      artworksCount: c._count.artworks,
      childrenCount: c._count.children,
      parentId: c.parentId,
    })),
  };
}

function refresh() {
  revalidatePath("/admin/artwork-form");
  revalidatePath("/studio/artworks/new");
}

// ─────────────────────────────────────────────────────────────────────────
// FORM FIELDS — label / required / visible / order / input type
// ─────────────────────────────────────────────────────────────────────────

const updateFieldSchema = z.object({
  key: z.string().min(1).max(60),
  label: z.string().trim().min(1).max(80).optional(),
  required: z.boolean().optional(),
  visible: z.boolean().optional(),
  inputType: z.enum(["text", "textarea", "number", "price", "select"]).optional(),
});

export async function updateFormFieldAction(input: z.infer<typeof updateFieldSchema>) {
  try {
    await requireAdmin();
    const parsed = updateFieldSchema.safeParse(input);
    if (!parsed.success) return { error: firstIssue(parsed.error) };
    const { key, label, required, visible, inputType } = parsed.data;

    const def = FORM_FIELD_REGISTRY.find((f) => f.key === key);
    if (!def) return { error: "Unknown field." };

    // System-locked fields: label only. Everything else is admin-managed.
    if (def.systemLocked && (required !== undefined || visible !== undefined)) {
      return { error: `"${def.defaultLabel}" is a core field — only its label can be changed.` };
    }
    if (inputType && !(def.allowedInputTypes || []).includes(inputType as FormFieldInputType)) {
      return { error: `This field cannot be changed to a ${inputType} input.` };
    }

    const data: Record<string, unknown> = {};
    if (label !== undefined) data.label = label;
    if (required !== undefined) data.required = required;
    if (visible !== undefined) data.visible = visible;
    if (inputType !== undefined) data.inputType = inputType;

    await prisma.artworkFormField.upsert({
      where: { key },
      create: {
        key,
        label: label || def.defaultLabel,
        section: def.section,
        inputType: inputType || def.inputType,
        required: required ?? def.defaultRequired,
        visible: visible ?? def.defaultVisible,
        position: def.defaultPosition,
        systemLocked: def.systemLocked,
      },
      update: data,
    });

    refresh();
    return { success: true };
  } catch (err) {
    return { error: toClientError("updateFormFieldAction error", err) };
  }
}

const reorderFieldSchema = z.object({
  key: z.string().min(1).max(60),
  direction: z.enum(["up", "down"]),
});

export async function reorderFormFieldAction(input: z.infer<typeof reorderFieldSchema>) {
  try {
    await requireAdmin();
    const parsed = reorderFieldSchema.safeParse(input);
    if (!parsed.success) return { error: firstIssue(parsed.error) };
    const { key, direction } = parsed.data;

    const def = FORM_FIELD_REGISTRY.find((f) => f.key === key);
    if (!def) return { error: "Unknown field." };
    if (def.systemLocked) return { error: "Core fields keep their fixed order." };

    // Resolve current ordering within the section (registry defaults merged
    // with DB overrides), then swap positions with the neighbour.
    const dbFields = await prisma.artworkFormField.findMany();
    const posOf = (k: string) => {
      const row = dbFields.find((r) => r.key === k);
      const d = FORM_FIELD_REGISTRY.find((f) => f.key === k)!;
      return row ? row.position : d.defaultPosition;
    };
    const siblings = FORM_FIELD_REGISTRY.filter((f) => f.section === def.section)
      .sort((a, b) => posOf(a.key) - posOf(b.key) || a.defaultPosition - b.defaultPosition);
    const idx = siblings.findIndex((f) => f.key === key);
    const other = direction === "up" ? siblings[idx - 1] : siblings[idx + 1];
    if (!other || other.systemLocked) return { error: "Cannot move further." };

    const myPos = posOf(key);
    const otherPos = posOf(other.key);

    await prisma.$transaction([
      prisma.artworkFormField.upsert({
        where: { key },
        create: {
          key,
          label: def.defaultLabel,
          section: def.section,
          inputType: def.inputType,
          required: def.defaultRequired,
          visible: def.defaultVisible,
          position: otherPos,
          systemLocked: def.systemLocked,
        },
        update: { position: otherPos },
      }),
      prisma.artworkFormField.upsert({
        where: { key: other.key },
        create: {
          key: other.key,
          label: other.defaultLabel,
          section: other.section,
          inputType: other.inputType,
          required: other.defaultRequired,
          visible: other.defaultVisible,
          position: myPos,
          systemLocked: other.systemLocked,
        },
        update: { position: myPos },
      }),
    ]);

    refresh();
    return { success: true };
  } catch (err) {
    return { error: toClientError("reorderFormFieldAction error", err) };
  }
}

// ─────────────────────────────────────────────────────────────────────────
// FIELD OPTIONS — dropdown choices (add / edit / delete / reorder)
// ─────────────────────────────────────────────────────────────────────────

const createOptionSchema = z.object({
  fieldKey: z.string().min(1).max(60),
  label: z.string().trim().min(1).max(80),
});

export async function createFieldOptionAction(input: z.infer<typeof createOptionSchema>) {
  try {
    await requireAdmin();
    const parsed = createOptionSchema.safeParse(input);
    if (!parsed.success) return { error: firstIssue(parsed.error) };
    const { fieldKey, label } = parsed.data;

    const def = FORM_FIELD_REGISTRY.find((f) => f.key === fieldKey);
    if (!def || def.optionsSource === "category" || def.optionsSource === "enum-productType") {
      return { error: "Options cannot be added to this field." };
    }

    const field = await prisma.artworkFormField.upsert({
      where: { key: fieldKey },
      create: {
        key: fieldKey,
        label: def.defaultLabel,
        section: def.section,
        inputType: def.inputType,
        required: def.defaultRequired,
        visible: def.defaultVisible,
        position: def.defaultPosition,
        systemLocked: def.systemLocked,
      },
      update: {},
      include: { options: true },
    });

    const value = slugify(label) || `option-${Date.now()}`;
    const existing = await prisma.artworkFormFieldOption.findUnique({
      where: { fieldId_value: { fieldId: field.id, value } },
    });
    if (existing) return { error: "An option with a similar name already exists." };

    const maxPos = field.options.reduce((m, o) => Math.max(m, o.position), -1);
    await prisma.artworkFormFieldOption.create({
      data: { fieldId: field.id, label: label.trim(), value, position: maxPos + 1 },
    });

    refresh();
    return { success: true };
  } catch (err) {
    return { error: toClientError("createFieldOptionAction error", err) };
  }
}

const updateOptionSchema = z.object({
  id: cuidSchema,
  label: z.string().trim().min(1).max(80),
});

export async function updateFieldOptionAction(input: z.infer<typeof updateOptionSchema>) {
  try {
    await requireAdmin();
    const parsed = updateOptionSchema.safeParse(input);
    if (!parsed.success) return { error: firstIssue(parsed.error) };

    await prisma.artworkFormFieldOption.update({
      where: { id: parsed.data.id },
      data: { label: parsed.data.label.trim() },
    });

    refresh();
    return { success: true };
  } catch (err) {
    return { error: toClientError("updateFieldOptionAction error", err) };
  }
}

export async function deleteFieldOptionAction(input: { id: string }) {
  try {
    await requireAdmin();
    const parsed = z.object({ id: cuidSchema }).safeParse(input);
    if (!parsed.success) return { error: firstIssue(parsed.error) };

    const option = await prisma.artworkFormFieldOption.findUnique({
      where: { id: parsed.data.id },
      include: { field: true },
    });
    if (!option) return { error: "Option not found." };
    if (option.isSystem) {
      return { error: "System options cannot be deleted — you can rename them." };
    }

    await prisma.artworkFormFieldOption.delete({ where: { id: option.id } });
    refresh();
    return { success: true };
  } catch (err) {
    return { error: toClientError("deleteFieldOptionAction error", err) };
  }
}

const reorderOptionSchema = z.object({
  id: cuidSchema,
  direction: z.enum(["up", "down"]),
});

export async function reorderFieldOptionAction(input: z.infer<typeof reorderOptionSchema>) {
  try {
    await requireAdmin();
    const parsed = reorderOptionSchema.safeParse(input);
    if (!parsed.success) return { error: firstIssue(parsed.error) };

    const option = await prisma.artworkFormFieldOption.findUnique({
      where: { id: parsed.data.id },
    });
    if (!option) return { error: "Option not found." };

    const siblings = await prisma.artworkFormFieldOption.findMany({
      where: { fieldId: option.fieldId },
      orderBy: { position: "asc" },
    });
    const idx = siblings.findIndex((o) => o.id === option.id);
    const other = parsed.data.direction === "up" ? siblings[idx - 1] : siblings[idx + 1];
    if (!other) return { error: "Cannot move further." };

    await prisma.$transaction([
      prisma.artworkFormFieldOption.update({
        where: { id: option.id },
        data: { position: other.position },
      }),
      prisma.artworkFormFieldOption.update({
        where: { id: other.id },
        data: { position: option.position },
      }),
    ]);

    refresh();
    return { success: true };
  } catch (err) {
    return { error: toClientError("reorderFieldOptionAction error", err) };
  }
}

// ─────────────────────────────────────────────────────────────────────────
// CATEGORIES — name / active / order / delete-with-reassign
// ─────────────────────────────────────────────────────────────────────────

const categoryInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500).optional(),
});

export async function createCategoryAction(input: z.infer<typeof categoryInputSchema>) {
  try {
    await requireAdmin();
    const parsed = categoryInputSchema.safeParse(input);
    if (!parsed.success) return { error: firstIssue(parsed.error) };

    const slug = slugify(parsed.data.name);
    const existing = await prisma.artworkCategory.findUnique({ where: { slug } });
    if (existing) return { error: "A category with a similar name already exists." };

    const maxPos = await prisma.artworkCategory.aggregate({ _max: { sortOrder: true } });
    await prisma.artworkCategory.create({
      data: {
        name: parsed.data.name.trim(),
        slug,
        description: parsed.data.description?.trim() || null,
        sortOrder: (maxPos._max.sortOrder ?? -1) + 1,
        isActive: true,
      },
    });

    refresh();
    revalidatePath("/explore");
    return { success: true };
  } catch (err) {
    return { error: toClientError("createCategoryAction error", err) };
  }
}

const updateCategorySchema = z.object({
  id: cuidSchema,
  name: z.string().trim().min(1).max(80).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  isActive: z.boolean().optional(),
});

export async function updateCategoryAction(input: z.infer<typeof updateCategorySchema>) {
  try {
    await requireAdmin();
    const parsed = updateCategorySchema.safeParse(input);
    if (!parsed.success) return { error: firstIssue(parsed.error) };
    const { id, name, description, isActive } = parsed.data;

    const data: Record<string, unknown> = {};
    if (name !== undefined) {
      const slug = slugify(name);
      const clash = await prisma.artworkCategory.findUnique({ where: { slug } });
      if (clash && clash.id !== id) return { error: "A category with a similar name already exists." };
      data.name = name.trim();
      data.slug = slug;
    }
    if (description !== undefined) data.description = description?.trim() || null;
    if (isActive !== undefined) data.isActive = isActive;

    await prisma.artworkCategory.update({ where: { id }, data });
    refresh();
    revalidatePath("/explore");
    return { success: true };
  } catch (err) {
    return { error: toClientError("updateCategoryAction error", err) };
  }
}

const deleteCategorySchema = z.object({
  id: cuidSchema,
  reassignToId: cuidSchema.optional(),
});

export async function deleteCategoryAction(input: z.infer<typeof deleteCategorySchema>) {
  try {
    await requireAdmin();
    const parsed = deleteCategorySchema.safeParse(input);
    if (!parsed.success) return { error: firstIssue(parsed.error) };
    const { id, reassignToId } = parsed.data;

    const category = await prisma.artworkCategory.findUnique({
      where: { id },
      include: { _count: { select: { artworks: true, children: true } } },
    });
    if (!category) return { error: "Category not found." };
    if (category._count.children > 0) {
      return { error: "This category has subcategories — move or delete them first." };
    }

    const artworkCount = category._count.artworks;

    if (artworkCount > 0) {
      if (!reassignToId || reassignToId === id) {
        return { error: "Choose a different category to move the artworks to." };
      }
      const target = await prisma.artworkCategory.findUnique({ where: { id: reassignToId } });
      if (!target || !target.isActive) {
        return { error: "Choose an active category to move artworks to." };
      }
      await prisma.$transaction([
        prisma.artwork.updateMany({
          where: { categoryId: id },
          data: { categoryId: reassignToId },
        }),
        prisma.artworkCategory.delete({ where: { id } }),
      ]);
    } else {
      await prisma.artworkCategory.delete({ where: { id } });
    }

    refresh();
    revalidatePath("/explore");
    return {
      success: true,
      movedArtworks: artworkCount,
    };
  } catch (err) {
    return { error: toClientError("deleteCategoryAction error", err) };
  }
}

const reorderCategorySchema = z.object({
  id: cuidSchema,
  direction: z.enum(["up", "down"]),
});

export async function reorderCategoryAction(input: z.infer<typeof reorderCategorySchema>) {
  try {
    await requireAdmin();
    const parsed = reorderCategorySchema.safeParse(input);
    if (!parsed.success) return { error: firstIssue(parsed.error) };

    const category = await prisma.artworkCategory.findUnique({ where: { id: parsed.data.id } });
    if (!category) return { error: "Category not found." };

    const siblings = await prisma.artworkCategory.findMany({
      orderBy: { sortOrder: "asc" },
    });
    const idx = siblings.findIndex((c) => c.id === category.id);
    const other = parsed.data.direction === "up" ? siblings[idx - 1] : siblings[idx + 1];
    if (!other) return { error: "Cannot move further." };

    await prisma.$transaction([
      prisma.artworkCategory.update({ where: { id: category.id }, data: { sortOrder: other.sortOrder } }),
      prisma.artworkCategory.update({ where: { id: other.id }, data: { sortOrder: category.sortOrder } }),
    ]);

    refresh();
    revalidatePath("/explore");
    return { success: true };
  } catch (err) {
    return { error: toClientError("reorderCategoryAction error", err) };
  }
}
