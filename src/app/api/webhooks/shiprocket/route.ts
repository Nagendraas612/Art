import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { handleShiprocketTrackingEvent } from "@/lib/shipments";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/webhooks/shiprocket
 *
 * Phase 3: receives shipment tracking updates from Shiprocket and advances
 * the Shipment status (forward-only) + records tracking events + notifies
 * the buyer on key milestones.
 *
 * Configure in the Shiprocket panel: Settings → API → Webhooks
 *   URL:             https://kalaabhadra.vercel.app/api/webhooks/shiprocket
 *   Auth Token Type: x-api-key
 *   Token:           the same value as the SHIPROCKET_WEBHOOK_TOKEN env var
 *   Events:         PICKED_UP, IN_TRANSIT, OUT_FOR_DELIVERY, DELIVERED,
 *                   RTO_INITIATED (+ any others you want tracked)
 *
 * Security: the token is verified with a timing-safe compare. The endpoint
 * never throws — a malformed payload returns 400, an unknown AWB returns
 * 200 with matched:false (so Shiprocket doesn't retry forever).
 */
function tokensEqual(a: string, b: string): boolean {
  if (!a || !b) return false;
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export async function POST(req: Request) {
  const expected = process.env.SHIPROCKET_WEBHOOK_TOKEN || "";
  if (!expected) {
    console.error(
      "[shiprocket-webhook] SHIPROCKET_WEBHOOK_TOKEN is not configured",
    );
    return NextResponse.json(
      { error: "webhook not configured" },
      { status: 500 },
    );
  }

  const provided =
    req.headers.get("x-api-key") ||
    req.headers.get("x-shiprocket-token") ||
    new URL(req.url).searchParams.get("token") ||
    "";
  if (!tokensEqual(provided, expected)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: unknown = null;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const result = await handleShiprocketTrackingEvent(payload);
  return NextResponse.json({ ok: true, ...result });
}
