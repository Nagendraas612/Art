"use server";

import { prisma } from "@/lib/prisma";
import { ArtworkStatus, Prisma } from "@prisma/client";
import { headers } from "next/headers";
import { checkRateLimit, rateLimitExceeded } from "@/lib/rate-limit";
import { firstIssue, searchArtworksSchema, toClientError } from "@/lib/validation";

export interface SearchInput {
  query?: string;
  category?: string;
  sort?: string;
  minPrice?: number;
  maxPrice?: number;
}

/**
 * Search published artworks by title, description, medium, and creator name.
 */
export async function searchArtworksAction(input: SearchInput) {
  try {
    // Normalize the legacy shape onto the validated schema.
    const parsed = searchArtworksSchema.safeParse({
      query: input.query,
      categorySlug: input.category,
      sort:
        input.sort === "price_asc" ||
        input.sort === "price_desc" ||
        input.sort === "popular" ||
        input.sort === "newest"
          ? input.sort
          : "newest",
      minPrice: input.minPrice,
      maxPrice: input.maxPrice,
    });
    if (!parsed.success)
      return { artworks: [], total: 0, error: firstIssue(parsed.error) };
    const { query, categorySlug, sort, minPrice, maxPrice, page, perPage } =
      parsed.data;

    // Public endpoint: rate-limit by IP.
    const ip =
      (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown";
    const rl = checkRateLimit(`search:${ip}`, 60, 60_000);
    if (!rl.allowed)
      return { artworks: [], total: 0, error: rateLimitExceeded(rl.retryAfterMs) };

    const where: Prisma.ArtworkWhereInput = {
      status: ArtworkStatus.PUBLISHED,
    };

    // Text search across multiple fields
    const q = query.trim();
    if (q.length > 0) {
      where.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { creator: { storeName: { contains: q, mode: "insensitive" } } },
        { creator: { user: { name: { contains: q, mode: "insensitive" } } } },
        { category: { name: { contains: q, mode: "insensitive" } } },
      ];
    }

    // Category filter
    if (categorySlug) {
      where.category = { slug: categorySlug };
    }

    // Price range
    if (minPrice !== undefined && minPrice > 0) {
      where.price = { ...(where.price as object), gte: minPrice };
    }
    if (maxPrice !== undefined && maxPrice > 0) {
      where.price = { ...(where.price as object), lte: maxPrice };
    }

    // Sorting
    let orderBy: Prisma.ArtworkOrderByWithRelationInput = {
      publishedAt: "desc",
    };
    if (sort === "price_asc") orderBy = { price: "asc" };
    else if (sort === "price_desc") orderBy = { price: "desc" };

    const [artworks, total] = await Promise.all([
      prisma.artwork.findMany({
        where,
        orderBy,
        take: perPage,
        skip: (page - 1) * perPage,
        include: {
          images: { orderBy: { sortOrder: "asc" }, take: 1 },
          creator: { include: { user: true } },
          category: true,
        },
      }),
      prisma.artwork.count({ where }),
    ]);

    return { artworks, total, page, perPage };
  } catch (error) {
    return {
      error: toClientError("searchArtworksAction error", error),
      artworks: [],
      total: 0,
    };
  }
}
