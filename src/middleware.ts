import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Stash the request path in a header so server layouts — which cannot read
 * the pathname directly — can build accurate post-sign-in callback URLs
 * (e.g. /studio/orders instead of a hardcoded /studio).
 *
 * Runs only on studio routes; everything else is untouched.
 */
export function middleware(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set(
    "x-request-path",
    request.nextUrl.pathname + request.nextUrl.search
  );
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/studio/:path*"],
};
