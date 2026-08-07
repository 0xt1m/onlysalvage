import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  // Without this, Next's dev server rejects cross-origin requests for its JS
  // chunks/HMR when the page is loaded from a LAN IP instead of localhost --
  // the initial HTML still renders, but hydration silently never completes,
  // so every button/slider/interaction on the page looks dead.
  allowedDevOrigins: ["192.168.12.188", "192.168.12.189"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.s3.amazonaws.com",
      },
    ],
  },
  // Baseline security headers -- nginx (see deploy/nginx.conf) sits in front
  // in production, but these apply regardless of what's proxying, and also
  // cover local dev (harmless there).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
