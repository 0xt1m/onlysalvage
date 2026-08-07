// The browser must call the API on whatever host it used to load the page
// (localhost during normal dev, a LAN IP when testing from a phone, the real
// domain in production) -- otherwise cross-site cookie rules silently drop
// the auth cookies. Server-side code (middleware, RSC data fetching) always
// runs on this machine though, so it can just talk to the API over
// localhost/INTERNAL_API_URL regardless of what the end user's browser is
// doing.
//
// NEXT_PUBLIC_API_PATH defaults to the Django dev server's own port, since
// local dev has no reverse proxy in front of it. Production sets
// NEXT_PUBLIC_API_PATH=/api instead -- nginx (see deploy/nginx.conf) proxies
// /api on the SAME origin as the frontend there, so there's no separate port
// at all, and cookies are genuinely same-origin rather than merely same-site.
export function getApiUrl(): string {
  if (typeof window !== "undefined") {
    const apiPath = process.env.NEXT_PUBLIC_API_PATH || ":8000/api";
    return `${window.location.protocol}//${window.location.hostname}${apiPath}`;
  }
  return process.env.INTERNAL_API_URL || "http://localhost:8000/api";
}
