"use server";

import { prisma } from "@/lib/prisma";
import { ArtworkStatus } from "@prisma/client";

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
    const { query, category, sort, minPrice, maxPrice } = input;

    const where: any = {
      status: ArtworkStatus.PUBLISHED,
    };

    // Text search across multiple fields
    if (query && query.trim().length > 0) {
      const q = query.trim();
      where.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { creator: { storeName: { contains: q, mode: "insensitive" } } },
        { creator: { user: { name: { contains: q, mode: "insensitive" } } } },
        { category: { name: { contains: q, mode: "insensitive" } } },
      ];
    }

    // Category filter
    if (category) {
      where.category = { ...where.category, slug: category };
    }

    // Price range
    if (minPrice !== undefined && minPrice > 0) {
      where.price = { ...where.price, gte: minPrice };
    }
    if (maxPrice !== undefined && maxPrice > 0) {
      where.price = { ...where.price, lte: maxPrice };
    }

    // Sorting
    let orderBy: any = { publishedAt: "desc" };
    if (sort === "price_asc") orderBy = { price: "asc" };
    else if (sort === "price_desc") orderBy = { price: "desc" };
    else if (sort === "title") orderBy = { title: "asc" };

    const artworks = await prisma.artwork.findMany({
      where,
      orderBy,
      take: 60,
      include: {
        images: { orderBy: { sortOrder: "asc" }, take: 1 },
        creator: { include: { user: true } },
        category: true,
      },
    });

    return { artworks, total: artworks.length };
  } catch (error) {
    console.error("searchArtworksAction error:", error);
    return { artworks: [], total: 0, error: "Search failed." };
  }
}
