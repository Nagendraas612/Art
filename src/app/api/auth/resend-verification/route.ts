import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Rate limit: 3 resends / 15 min / email+IP. Verification emails are a
// classic inbox-bombing vector, so this stays strict even though the
// client also enforces a 60s cooldown between clicks.
const RESEND_LIMIT = 3;
const RESEND_WINDOW_MS = 15 * 60_000;

const bodySchema = z.object({
  email: z.string().email().max(254),
});

export async function POST(req: NextRequest) {
  const ip = getClientIp(await headers());

  let email: string;
  try {
    const body = await req.json();
    email = bodySchema.parse(body).email.toLowerCase().trim();
  } catch {
    return NextResponse.json(
      { error: "Please provide a valid email address." },
      { status: 400 }
    );
  }

  const rl = await checkRateLimit(
    `resend-verify:${email}:${ip}`,
    RESEND_LIMIT,
    RESEND_WINDOW_MS
  );
  if (!rl.allowed) {
    return NextResponse.json(
      {
        error:
          "Too many verification emails sent. Please wait a few minutes and try again.",
      },
      { status: 429 }
    );
  }

  try {
    await auth.api.sendVerificationEmail({
      body: { email },
      headers: await headers(),
    });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    // Anti-enumeration: always answer success, even for already-verified
    // addresses or send failures. The distinction is logged server-side only
    // so an unauthenticated caller cannot learn which emails are registered.
    if (/already verified/i.test(msg)) {
      console.log("[resend-verification] already verified:", email);
    } else {
      console.error("[resend-verification] failed:", msg);
    }
    return NextResponse.json({ success: true });
  }
}
