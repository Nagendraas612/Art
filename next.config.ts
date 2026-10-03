import type { NextConfig } from "next";

// P8: the image optimizer is no longer an open proxy. Only hosts we actually
// use are allowed: our Cloudinary pipeline, legacy Unsplash seed photos, and
// Cashfree's checkout assets. Everything else 400s at the optimizer.
const IMAGE_HOSTS = [
  "res.cloudinary.com",
  "images.unsplash.com",
  "images.pexels.com",
  "cashfree.com",
  "www.cashfree.com",
];

// P8: Content-Security-Policy. `unsafe-inline`/`unsafe-eval` are required by
// Next.js itself (inline scripts/styles); everything else is locked down:
// - scripts/styles: self + inline (Next) — no third-party JS at all
// - images: self, data:, blob:, our image hosts
// - connects (fetch/XHR/beacon): self + Cashfree SDK/API + Cloudinary upload
// - frames: Cashfree checkout only (payment iframe)
// - no object/embed, no base-uri hijack, no form-action exfil
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://sdk.cashfree.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://res.cloudinary.com https://images.unsplash.com https://images.pexels.com",
  "font-src 'self' data:",
  "connect-src 'self' https://api.cashfree.com https://sandbox.cashfree.com https://sdk.cashfree.com https://api.cloudinary.com",
  "frame-src https://www.cashfree.com https://sandbox.cashfree.com https://payments.cashfree.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  images: {
    remotePatterns: IMAGE_HOSTS.map((hostname) => ({
      protocol: "https" as const,
      hostname,
    })),
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Content-Security-Policy",
            value: csp,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
