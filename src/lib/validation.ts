import { z } from "zod";

/**
 * Shared input-validation schemas for every server action boundary (P7).
 *
 * Rules of the road:
 * - Every server action must `safeParse` its inputs before touching the DB.
 * - On failure, return a single human-readable message to the client
 *   (parsed.error.issues[0].message) — never the raw zod error tree.
 * - Database/Prisma errors must never leak to the client: log them
 *   server-side and return a generic message via `toClientError`.
 */

/* ------------------------------------------------------------------ */
/* Primitives                                                          */
/* ------------------------------------------------------------------ */

/** Prisma cuid() identifiers. */
export const cuidSchema = z
  .string()
  .regex(/^c[a-z0-9]{24}$/i, "Invalid identifier.")
  .max(64);

/** Names, titles, subjects — non-empty, bounded. */
export const nameSchema = z
  .string()
  .trim()
  .min(1, "This field is required.")
  .max(120, "Must be 120 characters or fewer.");

export const shortTextSchema = (max: number) =>
  z.string().trim().max(max, `Must be ${max} characters or fewer.`);

export const longTextSchema = (min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min, `Must be at least ${min} characters.`)
    .max(max, `Must be ${max} characters or fewer.`);

/** RFC-compliant email, bounded length. */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Email is required.")
  .email("Enter a valid email address.")
  .max(254, "Email is too long.");

/**
 * Indian mobile number: 10 digits, starting 6-9.
 * Optional +91 / 91 / 0 prefix is accepted and normalized away.
 */
export const phoneINSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, "").replace(/^(\+91|91|0)/, ""))
  .pipe(
    z
      .string()
      .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number.")
  );

/** Indian PIN code: 6 digits, first digit non-zero. */
export const pinCodeSchema = z
  .string()
  .trim()
  .regex(/^[1-9][0-9]{5}$/, "Enter a valid 6-digit PIN code.");

/** Generic https URL, bounded. */
export const httpsUrlSchema = z
  .string()
  .trim()
  .url("Enter a valid URL.")
  .refine((v) => v.startsWith("https://"), "URL must use https.")
  .refine((v) => v.length <= 2048, "URL is too long.");

/**
 * Image URLs must come from our own upload pipeline (Cloudinary), the
 * legacy Unsplash seed photos, or the app's own domain. Arbitrary
 * hotlinked URLs are a phishing/malware hosting vector (P8).
 */
const IMAGE_URL_HOSTS = new Set([
  "images.unsplash.com",
  "images.pexels.com",
]);

export const uploadedImageUrlSchema = httpsUrlSchema.refine((v) => {
  try {
    const url = new URL(v);
    const host = url.hostname.toLowerCase();
    if (host === "res.cloudinary.com") {
      // Pin to OUR Cloudinary cloud: the hostname alone also serves every
      // other Cloudinary customer, so require our cloud name as the first
      // path segment (https://res.cloudinary.com/<cloud>/...).
      const cloudName = (
        process.env.CLOUDINARY_CLOUD_NAME ||
        process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ||
        ""
      ).toLowerCase();
      if (!cloudName) return false;
      return url.pathname.toLowerCase().startsWith(`/${cloudName}/`);
    }
    if (IMAGE_URL_HOSTS.has(host)) return true;
    const appHost = process.env.NEXT_PUBLIC_APP_URL
      ? new URL(process.env.NEXT_PUBLIC_APP_URL).hostname.toLowerCase()
      : null;
    return appHost !== null && host === appHost;
  } catch {
    return false;
  }
}, "Image must be uploaded through Kalaa Bhadra.");

export const optionalImageUrlSchema = z
  .union([z.literal(""), uploadedImageUrlSchema])
  .optional()
  .transform((v) => (v ? v : undefined));

export const ratingSchema = z
  .number({ error: "Rating is required." })
  .int("Rating must be a whole number.")
  .min(1, "Rating must be at least 1.")
  .max(5, "Rating must be at most 5.");

export const quantitySchema = z
  .number({ error: "Quantity is required." })
  .int("Quantity must be a whole number.")
  .min(1, "Quantity must be at least 1.")
  .max(99, "Quantity must be at most 99.");

/** Money in INR: finite, non-negative, ≤ ₹1 crore, 2dp. */
export const moneySchema = z
  .number({ error: "Amount is required." })
  .finite("Amount must be a number.")
  .min(0, "Amount cannot be negative.")
  .max(10_000_000, "Amount is too large.")
  .transform((v) => Math.round(v * 100) / 100);

export const slugSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9-]+$/, "Invalid slug.")
  .max(120);

/* ------------------------------------------------------------------ */
/* Composite inputs                                                    */
/* ------------------------------------------------------------------ */

export const checkoutItemSchema = z.object({
  id: cuidSchema,
  quantity: quantitySchema,
});

export const checkoutInputSchema = z.object({
  items: z
    .array(checkoutItemSchema)
    .min(1, "Your cart is empty.")
    .max(50, "Too many items in one order."),
  customer: z.object({
    fullName: nameSchema,
    email: emailSchema,
    phone: phoneINSchema,
  }),
  shippingAddress: z.object({
    line1: shortTextSchema(200).refine((v) => v.length > 0, "Address line 1 is required."),
    line2: shortTextSchema(200).optional().default(""),
    city: shortTextSchema(100).refine((v) => v.length > 0, "City is required."),
    state: shortTextSchema(100).refine((v) => v.length > 0, "State is required."),
    postalCode: pinCodeSchema,
    country: shortTextSchema(100).refine((v) => v.length > 0, "Country is required."),
  }),
});

export type CheckoutInput = z.infer<typeof checkoutInputSchema>;

export const sendMessageSchema = z.object({
  conversationId: cuidSchema,
  body: longTextSchema(1, 5000),
  attachmentUrl: optionalImageUrlSchema,
});

export const startConversationSchema = z.object({
  creatorId: cuidSchema,
  initialMessage: longTextSchema(1, 5000).optional(),
  orderRefId: cuidSchema.optional(),
});

export const submitReviewSchema = z.object({
  artworkId: cuidSchema,
  rating: ratingSchema,
  text: longTextSchema(5, 5000),
  imageUrl: optionalImageUrlSchema,
});

export const customRequestSchema = z.object({
  creatorId: cuidSchema,
  description: longTextSchema(10, 5000),
  preferredSize: shortTextSchema(100).optional(),
  preferredMedium: shortTextSchema(100).optional(),
  budget: moneySchema.optional(),
  deadline: z
    .string()
    .trim()
    .refine((v) => !v || !Number.isNaN(Date.parse(v)), "Invalid date.")
    .optional(),
  referenceImageUrl: optionalImageUrlSchema,
});

export const searchArtworksSchema = z.object({
  query: shortTextSchema(200).optional().default(""),
  categorySlug: slugSchema.optional(),
  sort: z.enum(["newest", "price_asc", "price_desc", "popular"]).optional().default("newest"),
  minPrice: z.number().finite().min(0).max(10_000_000).optional(),
  maxPrice: z.number().finite().min(0).max(10_000_000).optional(),
  page: z.number().int().min(1).max(1000).optional().default(1),
  perPage: z.number().int().min(1).max(60).optional().default(24),
});

export const artworkFormSchema = z.object({
  title: nameSchema.max(200),
  categoryId: cuidSchema,
  productType: z.enum(["ORIGINAL", "LIMITED_EDITION", "OPEN_EDITION", "PRINT"]),
  price: moneySchema.refine((v) => v > 0, "Price must be greater than zero."),
  description: longTextSchema(20, 10000),
  stock: z.number().int().min(1).max(10000),
  editionSize: z.number().int().min(2).max(100000).optional(),
  medium: shortTextSchema(100).optional(),
  surface: shortTextSchema(100).optional(),
  clayBody: shortTextSchema(100).optional(),
  glaze: shortTextSchema(100).optional(),
  timber: shortTextSchema(100).optional(),
  fibers: shortTextSchema(100).optional(),
  paper: shortTextSchema(100).optional(),
  printingMethod: shortTextSchema(100).optional(),
  widthCm: z.number().finite().min(0).max(10000).optional(),
  heightCm: z.number().finite().min(0).max(10000).optional(),
  depthCm: z.number().finite().min(0).max(10000).optional(),
  weightGrams: z.number().int().min(0).max(1000000).optional(),
  isSigned: z.boolean().optional().default(false),
  hasCertificate: z.boolean().optional().default(false),
  provenanceNote: shortTextSchema(2000).optional(),
  isFragile: z.boolean().optional().default(false),
  processingDays: z.number().int().min(1).max(90).optional().default(3),
  primaryImageUrl: uploadedImageUrlSchema,
  galleryImageUrls: z.array(uploadedImageUrlSchema).max(10).optional().default([]),
});

export type ArtworkFormInput = z.infer<typeof artworkFormSchema>;

/* ------------------------------------------------------------------ */
/* Error handling                                                      */
/* ------------------------------------------------------------------ */

/**
 * Convert a caught error into a safe client-facing message.
 * Always log the original server-side first — this only shapes
 * what the browser sees.
 *
 * The `success?: undefined` member keeps the inferred union discriminated,
 * so client code can keep reading `result.error` / `result.success`
 * without narrowing first.
 */
export function toClientError(
  logContext: string,
  error: unknown,
  fallback = "Something went wrong. Please try again."
): string {
  if (error instanceof Error) {
    console.error(`${logContext}:`, error.message);
  } else {
    console.error(`${logContext}:`, error);
  }
  // Returns only the message: call sites wrap it in a fresh `{ error: ... }`
  // literal so TypeScript keeps the success/error union discriminated.
  return fallback;
}

/** Extract the first human-readable message from a zod parse failure. */
export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input.";
}
