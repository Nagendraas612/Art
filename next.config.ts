import type { NextConfig } from "next";

// P8: the image optimizer is no longer an open proxy. Only hosts we actually
// use are allowed: our Cloudinary pipeline, the artwork photo hosts used by
// the seed / image-repair script, and Razorpay's checkout assets. Everything
// else 400s at the optimizer.
const IMAGE_HOSTS = [
  "res.cloudinary.com",
  "images.unsplash.com",
  "images.pexels.com",
  "images.stockcake.com",
  "cdn.myportfolio.com",
  "lh3.googleusercontent.com", // Google OAuth avatars
];
const CHECKOUT_ASSET_HOSTS = ["checkout.razorpay.com", "api.razorpay.com"];
const REMOTE_IMAGE_HOSTS = [...IMAGE_HOSTS, ...CHECKOUT_ASSET_HOSTS];

// P8: Content-Security-Policy. `unsafe-inline`/`unsafe-eval` are required by
// Next.js itself (inline scripts/styles); everything else is locked down:
// - scripts/styles: self + inline (Next) + Razorpay checkout.js
// - images: self, data:, blob:, our image hosts
// - connects (fetch/XHR/beacon): self + Razorpay API + Cloudinary upload
// - frames: Razorpay checkout only (payment iframe)
// - no object/embed, no base-uri hijack, no form-action exfil
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: " + IMAGE_HOSTS.map((h) => `https://${h}`).join(" "),
  "font-src 'self' data:",
  "connect-src 'self' https://api.razorpay.com https://checkout.razorpay.com https://api.cloudinary.com",
  "frame-src https://checkout.razorpay.com https://api.razorpay.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  images: {
    remotePatterns: REMOTE_IMAGE_HOSTS.map((hostname) => ({
      protocol: "https" as const,
      hostname,
    })),
  },
  async redirects() {
    return [
      // The bag lives at /cart; /bag 404'd for anyone typing it.
      { source: "/bag", destination: "/cart", permanent: true },
    ];
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
