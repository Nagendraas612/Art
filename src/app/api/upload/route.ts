import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { createHash } from "node:crypto";
import { getSession } from "@/modules/auth/guards";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Upload rate limit: 20 uploads / minute / user via the shared limiter (P8).

// ---------------------------------------------------------------------------
// Magic-byte sniffing. file.type comes from the client-constructed File
// object and is trivially spoofable — never trust it for validation.
// ---------------------------------------------------------------------------
function detectImageMime(buffer: Buffer): string | null {
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return "image/jpeg";
  }
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  if (buffer.length >= 6) {
    const gif = buffer.toString("ascii", 0, 6);
    if (gif === "GIF87a" || gif === "GIF89a") return "image/gif";
  }
  if (buffer.length >= 12 && buffer.toString("ascii", 4, 8) === "ftyp") {
    const brand = buffer.toString("ascii", 8, 12);
    if (brand === "avif" || brand === "avis") return "image/avif";
  }
  return null;
}

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
];
const MAX_SIZE = 8 * 1024 * 1024;

// ---------------------------------------------------------------------------
// Cloudinary SIGNED upload. The old code used an unsigned upload preset,
// which let any anonymous caller push files to your Cloudinary account
// (quota/cost burn under your name). Signed requests are generated here,
// server-side, per upload.
// ---------------------------------------------------------------------------
async function uploadToCloudinarySigned(
  bytes: ArrayBuffer,
  mime: string,
  filename: string
): Promise<string | null> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) return null;

  const timestamp = Math.round(Date.now() / 1000);
  // Signature = SHA-1 hex of the sorted "param=value&..." string + api_secret.
  const signature = createHash("sha1")
    .update(`timestamp=${timestamp}${apiSecret}`)
    .digest("hex");

  const form = new FormData();
  form.append("file", new Blob([bytes], { type: mime }), filename || "upload");
  form.append("api_key", apiKey);
  form.append("timestamp", String(timestamp));
  form.append("signature", signature);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    { method: "POST", body: form }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return typeof data.secure_url === "string" ? data.secure_url : null;
}

export async function POST(req: NextRequest) {
  // 1. Authentication — uploads are a privileged operation.
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Please sign in to upload images." },
      { status: 401 }
    );
  }

  // 1b. Origin check (defense in depth): this is a Route Handler, not a
  // Server Action, so Next.js does not enforce Origin for us. SameSite
  // cookies already block CSRF in modern browsers; this closes the gap
  // if cookie handling is ever degraded.
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (origin && host && new URL(origin).host !== host) {
    return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  }

  // 2. Authorization — any authenticated user may upload (the become-a-creator
  // onboarding form requires uploads before a creator profile exists).
  // Abuse is mitigated by rate limiting (step 3) + magic-byte validation (step 4).

  // 3. Rate limit per user (IP as an extra key segment).
  const ip = getClientIp(await headers());
  const rl = await checkRateLimit(`upload:${session.user.id}:${ip}`, 20, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many uploads. Please wait a minute and try again." },
      { status: 429 }
    );
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "Image size exceeds 8MB limit. Please upload a smaller image." },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // 4. Verify actual content — never trust client-supplied file.type.
    const detected = detectImageMime(buffer);
    if (!detected || !ALLOWED_MIME_TYPES.includes(detected)) {
      return NextResponse.json(
        {
          error:
            "Invalid file format. Please upload a genuine JPEG, PNG, or WebP image.",
        },
        { status: 400 }
      );
    }

    // 5. Signed Cloudinary upload. Fail closed when unconfigured — the old
    // base64-data-URI-in-Postgres fallback let anyone write 8MB rows to the
    // database on every request.
    const url = await uploadToCloudinarySigned(bytes, detected, file.name);
    if (!url) {
      return NextResponse.json(
        {
          error:
            "Image uploads are temporarily unavailable. Please try again later.",
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      success: true,
      url,
      filename: file.name,
      size: buffer.length,
      mimeType: detected,
    });
  } catch (error) {
    console.error("[Upload API] Error processing upload:", error);
    return NextResponse.json(
      { error: "Failed to process image upload" },
      { status: 500 }
    );
  }
}
