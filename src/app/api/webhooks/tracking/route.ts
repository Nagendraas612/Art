import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/webhooks/tracking
 *
 * Phase 3: receives shipment tracking updates from Shiprocket and advances
 * the Shipment status (forward-only) + records tracking events + notifies
 * the buyer on key milestones.
 *
 * Performance: this route is deliberately light. Token check, body parse
 * and AWB extraction run with NO heavy imports — Prisma / @/lib/shipments
 * are dynamically imported only when a real AWB needs processing. This
 * keeps Shiprocket's endpoint validation (and test pings, which carry no
 * AWB) responding in ~1s instead of timing out on a cold start.
 *
 * Configure in the Shiprocket panel: Settings → API → Webhooks
 *   URL:             https://kalaabhadra.vercel.app/api/webhooks/tracking
 *   Auth Token Type: x-api-key
 *   Token:           the same value as the SHIPROCKET_WEBHOOK_TOKEN env var
 *   Events:          PICKED_UP, IN_TRANSIT, OUT_FOR_DELIVERY, DELIVERED,
 *                    RTO_INITIATED (+ any others you want tracked)
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

/**
 * Lightweight AWB extraction — pure function, no imports. Mirrors the
 * extractor in @/lib/shipments (kept separate so this route stays light).
 */
function extractAwb(payload: any): string | null {
  if (!payload || typeof payload !== "object") return null;
  const candidates = [
    payload.awb,
    payload.awb_code,
    payload.awbCode,
    payload.data?.awb_code,
    payload.data?.awb,
    payload.shipment?.awb,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return null;
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

  // Fast path: validation pings and test payloads carry no AWB.
  // Answer 200 immediately without loading Prisma — this is what keeps
  // Shiprocket's endpoint check from timing out on a cold start.
  const awb = extractAwb(payload);
  if (!awb) {
    return NextResponse.json({ ok: true, matched: false });
  }

  // Heavy path: real tracking event — load the handler (and Prisma) now.
  const { handleShiprocketTrackingEvent } = await import("@/lib/shipments");
  const result = await handleShiprocketTrackingEvent(payload);
  return NextResponse.json({ ok: true, ...result });
}
