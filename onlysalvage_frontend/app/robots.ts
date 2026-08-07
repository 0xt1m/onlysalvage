import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/login",
        "/sign-up",
        "/forgot-password",
        "/reset-password",
        "/inventory/*/edit",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
