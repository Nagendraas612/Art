import { NextResponse } from "next/server";
import { getShippingSettings } from "@/lib/shipping";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Public read of the current insured-logistics settings for the
 * client-side cart and checkout pages. Display data only — the order's
 * authoritative fee is computed server-side in the checkout action.
 */
export async function GET() {
  const settings = await getShippingSettings();
  return NextResponse.json({
    flatFee: settings.flatFee,
    freeThreshold: settings.freeThreshold,
  });
}
