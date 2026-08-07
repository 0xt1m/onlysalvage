// Falls back to localhost so metadataBase/sitemap/robots still resolve in dev
// when NEXT_PUBLIC_SITE_URL isn't set.
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
