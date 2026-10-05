import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

// The old per-instance Map limiter is gone: on Vercel each serverless
// instance had its own bucket (N x the limit across a warm fleet), and it
// never consulted Upstash. These now go through the shared limiter, which
// falls back to memory per-instance only when Upstash is unconfigured
// (and logs a production warning when it does).

function tooMany(message: string) {
  return new NextResponse(
    JSON.stringify({ error: message }),
    { status: 429, headers: { "Content-Type": "application/json", "Retry-After": "60" } }
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ip = getClientIp(request.headers);

  // Rate limit authentication API endpoints (30 req / minute)
  if (pathname.startsWith("/api/auth")) {
    const rl = await checkRateLimit(`proxy:auth:${ip}`, 30, 60 * 1000);
    if (!rl.allowed) {
      return tooMany("Too many authentication requests. Please try again in a minute.");
    }
  }

  // Rate limit checkout operations (10 POST req / minute)
  if (pathname.startsWith("/checkout") || pathname.startsWith("/api/checkout")) {
    if (request.method === "POST") {
      const rl = await checkRateLimit(`proxy:checkout:${ip}`, 10, 60 * 1000);
      if (!rl.allowed) {
        return tooMany("Too many checkout attempts. Please wait a moment before trying again.");
      }
    }
  }

  // Stash the request path for studio routes so the studio layout (which
  // cannot read the pathname directly) can build accurate post-sign-in
  // callback URLs, e.g. /studio/orders instead of a hardcoded /studio.
  if (pathname.startsWith("/studio")) {
    const headers = new Headers(request.headers);
    headers.set("x-request-path", pathname + request.nextUrl.search);
    return NextResponse.next({ request: { headers } });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/auth/:path*", "/checkout", "/api/checkout/:path*", "/studio/:path*"],
};
