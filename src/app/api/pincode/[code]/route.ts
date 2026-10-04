import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// In-memory cache: pincode -> { city, state }. India Post data barely
// changes, so a long TTL is safe and keeps the lookup instant.
const cache = new Map<string, { at: number; city: string; state: string }>();
const CACHE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface PostOffice {
  District?: string;
  State?: string;
}

/**
 * Pincode -> city/state lookup via India Post's free API.
 * Used by every address form (creator application, checkout) so the buyer
 * types 6 digits and city/state fill themselves in.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "Invalid pincode" }, { status: 400 });
  }

  const cached = cache.get(code);
  if (cached && Date.now() - cached.at < CACHE_MS) {
    return NextResponse.json({ pincode: code, city: cached.city, state: cached.state });
  }

  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${code}`, {
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 86400 },
    });
    if (!res.ok) {
      return NextResponse.json({ error: "Lookup failed" }, { status: 502 });
    }
    const data = (await res.json()) as Array<{
      Status?: string;
      PostOffice?: PostOffice[] | null;
    }>;
    const offices = data?.[0]?.PostOffice;
    if (!offices || offices.length === 0) {
      return NextResponse.json({ error: "Pincode not found" }, { status: 404 });
    }
    // First post office's district/state; the fields stay editable in the UI.
    const city = offices[0].District || "";
    const state = offices[0].State || "";
    if (!city || !state) {
      return NextResponse.json({ error: "Pincode not found" }, { status: 404 });
    }
    cache.set(code, { at: Date.now(), city, state });
    return NextResponse.json({ pincode: code, city, state });
  } catch {
    return NextResponse.json({ error: "Lookup failed" }, { status: 502 });
  }
}
