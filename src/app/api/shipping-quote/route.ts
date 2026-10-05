import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getShippingSettings } from "@/lib/shipping";
import { calculateShippingFee } from "@/lib/shipping-shared";
import { calculateLiveShippingFee } from "@/lib/shiprocket";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const quoteSchema = z.object({
  items: z
    .array(z.object({ id: z.string().min(1), quantity: z.number().int().min(1).max(99) }))
    .min(1)
    .max(100),
  pincode: z.string().regex(/^\d{6}$/),
});

/**
 * POST /api/shipping-quote
 * Body: { items: [{id, quantity}], pincode }
 *
 * Live insured-logistics quote for the checkout page: cheapest Shiprocket
 * rate per creator pickup location, summed. Falls back to the admin
 * flat fee when live rating is impossible (no credentials, unknown lane,
 * API failure). Above the free-shipping threshold the fee is ₹0 without
 * calling Shiprocket at all.
 *
 * The server action (processCheckout) recomputes this independently —
 * this endpoint is display-only.
 */
export async function POST(req: Request) {
  try {
    // Unauthenticated and fans out to live Shiprocket calls — throttle it
    // so nobody can burn courier quota / server load in a loop.
    const ip = getClientIp(req.headers);
    const rl = await checkRateLimit(`shipping-quote:${ip}`, 30, 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many quote requests. Please wait a moment and try again." },
        { status: 429 }
      );
    }

    const parsed = quoteSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid quote request" }, { status: 400 });
    }
    const { items, pincode } = parsed.data;

    const artworks = await prisma.artwork.findMany({
      where: { id: { in: items.map((i) => i.id) }, status: "PUBLISHED" },
      select: {
        id: true,
        price: true,
        weightGrams: true,
        widthCm: true,
        heightCm: true,
        depthCm: true,
        creatorId: true,
        creator: {
          select: { pickupPincode: true },
        },
      },
    });

    const settings = await getShippingSettings();
    const byId = new Map(artworks.map((a) => [a.id, a]));
    let subtotal = 0;

    // Group by creator: one Shiprocket lane per pickup location.
    const groups = new Map<
      string,
      {
        pickupPincode: string | null;
        weightGrams: number;
        widthCm: number | null;
        heightCm: number | null;
        depthCm: number | null;
      }
    >();

    for (const item of items) {
      const a = byId.get(item.id);
      if (!a) continue;
      subtotal += Number(a.price) * item.quantity;
      const g = groups.get(a.creatorId) || {
        pickupPincode: a.creator?.pickupPincode || settings.defaultPickupPincode || null,
        weightGrams: 0,
        widthCm: null,
        heightCm: null,
        depthCm: null,
      };
      g.weightGrams += Number(a.weightGrams || 0) * item.quantity;
      g.widthCm = Math.max(g.widthCm || 0, Number(a.widthCm || 0)) || null;
      g.heightCm = Math.max(g.heightCm || 0, Number(a.heightCm || 0)) || null;
      g.depthCm = Math.max(g.depthCm || 0, Number(a.depthCm || 0)) || null;
      groups.set(a.creatorId, g);
    }

    // Free shipping above the threshold — no Shiprocket call needed.
    if (subtotal > settings.freeThreshold) {
      return NextResponse.json({ fee: 0, live: false, complimentary: true });
    }

    const quote = await calculateLiveShippingFee(
      [...groups.values()].map((g) => ({
        pickupPincode: g.pickupPincode,
        weightGrams: g.weightGrams,
        widthCm: g.widthCm,
        heightCm: g.heightCm,
        depthCm: g.depthCm,
      })),
      pincode,
    );

    if (quote.fee !== null) {
      return NextResponse.json({
        fee: quote.fee,
        live: true,
        lines: quote.lines,
      });
    }

    // Silent emergency fallback: the admin flat fee.
    return NextResponse.json({
      fee: calculateShippingFee(subtotal, settings),
      live: false,
      fallback: true,
    });
  } catch (e) {
    console.error("[shipping-quote] failed:", e);
    return NextResponse.json({ error: "Quote failed" }, { status: 500 });
  }
}
