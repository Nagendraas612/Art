import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Simple in-memory rate limiter per serverless instance
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanupStaleEntries() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, value] of rateLimitMap.entries()) {
    if (now > value.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}

function isRateLimited(ip: string, keyPrefix: string, maxRequests: number, windowMs: number): boolean {
  cleanupStaleEntries();
  const now = Date.now();
  const key = `${ip}:${keyPrefix}`;
  const record = rateLimitMap.get(key);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
    return false;
  }

  record.count += 1;
  if (record.count > maxRequests) {
    return true;
  }
  return false;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "127.0.0.1";

  // Rate limit authentication API endpoints (30 req / minute)
  if (pathname.startsWith("/api/auth")) {
    if (isRateLimited(ip, "auth_api", 30, 60 * 1000)) {
      return new NextResponse(
        JSON.stringify({ error: "Too many authentication requests. Please try again in a minute." }),
        { status: 429, headers: { "Content-Type": "application/json", "Retry-After": "60" } }
      );
    }
  }

  // Rate limit checkout operations (10 POST req / minute)
  if (pathname.startsWith("/checkout") || pathname.startsWith("/api/checkout")) {
    if (request.method === "POST" && isRateLimited(ip, "checkout", 10, 60 * 1000)) {
      return new NextResponse(
        JSON.stringify({ error: "Too many checkout attempts. Please wait a moment before trying again." }),
        { status: 429, headers: { "Content-Type": "application/json", "Retry-After": "60" } }
      );
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
