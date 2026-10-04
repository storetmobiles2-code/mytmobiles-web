import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Content-Security-Policy. Scripts allow 'unsafe-inline' because Next.js emits
 * inline bootstrap scripts and a nonce would force every page to render
 * dynamically (losing static/ISR caching). Everything else is locked down to
 * our own origin plus Razorpay Checkout and (optionally) Google Analytics.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${isDev ? "'unsafe-eval'" : ""} https://checkout.razorpay.com https://www.googletagmanager.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.razorpay.com https://www.googletagmanager.com https://*.google-analytics.com",
  "font-src 'self' data:",
  "connect-src 'self' https://*.razorpay.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com",
  "frame-src https://api.razorpay.com https://checkout.razorpay.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=(), payment=(self \"https://checkout.razorpay.com\" \"https://api.razorpay.com\")" },
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    // Admin image uploads (validated to ≤ 8 MB in src/lib/admin/media.ts).
    serverActions: { bodySizeLimit: "10mb" },
  },
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [360, 480, 640, 768, 1024, 1280, 1600],
    imageSizes: [32, 48, 64, 96, 128, 160, 240, 320],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    localPatterns: [{ pathname: "/images/**" }, { pathname: "/media/**" }],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/images/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
      { source: "/admin/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
    ];
  },
};

export default nextConfig;
