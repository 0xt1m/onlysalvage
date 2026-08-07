import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { getApiUrl } from "./lib/apiUrl";

const intlMiddleware = createMiddleware(routing);

const PROTECTED_PREFIXES = ["/users", "/dashboard", "/sell", "/complete-profile", "/settings"];

function isExpired(token: string): boolean {
  try {
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(base64));
    return !payload.exp || Date.now() >= payload.exp * 1000;
  } catch {
    return true;
  }
}

// 'as-needed' means English (the default) has no /en prefix, so recognizing a
// locale in the path only means checking for the non-default ones explicitly.
function splitLocale(pathname: string): { locale: string; rest: string } {
  for (const locale of routing.locales) {
    if (locale === routing.defaultLocale) continue;
    if (pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)) {
      return { locale, rest: pathname.slice(locale.length + 1) || "/" };
    }
  }
  return { locale: routing.defaultLocale, rest: pathname };
}

function loginRedirectUrl(request: NextRequest, rest: string, localePrefix: string): URL {
  const url = new URL(`${localePrefix}/login`, request.url);
  if (rest.startsWith("/sell")) {
    url.searchParams.set("reason", "sell");
  }
  return url;
}

export async function middleware(request: NextRequest) {
  const intlResponse = intlMiddleware(request);

  const { locale, rest } = splitLocale(request.nextUrl.pathname);
  const localePrefix = locale === routing.defaultLocale ? "" : `/${locale}`;
  // Match the whole path segment, not just a string prefix -- "/sell" would
  // otherwise also match "/sellers" (the public sellers-browse page) and
  // force it behind login.
  const isProtectedRoute = PROTECTED_PREFIXES.some(
    (prefix) => rest === prefix || rest.startsWith(`${prefix}/`)
  );

  const accessToken = request.cookies.get("access")?.value;
  const refreshToken = request.cookies.get("refresh_token")?.value;

  const needsRefresh = !accessToken || isExpired(accessToken);

  if (!needsRefresh) {
    return intlResponse;
  }

  if (!refreshToken) {
    return isProtectedRoute
      ? NextResponse.redirect(loginRedirectUrl(request, rest, localePrefix))
      : intlResponse;
  }

  let refreshRes: Response;
  try {
    refreshRes = await fetch(`${getApiUrl()}/auth/refresh/`, {
      method: "POST",
      headers: { Cookie: `refresh_token=${refreshToken}` },
    });
  } catch {
    return isProtectedRoute
      ? NextResponse.redirect(loginRedirectUrl(request, rest, localePrefix))
      : intlResponse;
  }

  if (!refreshRes.ok) {
    return isProtectedRoute
      ? NextResponse.redirect(loginRedirectUrl(request, rest, localePrefix))
      : intlResponse;
  }

  const setCookies = refreshRes.headers.getSetCookie?.() ?? [];

  // Apply the refreshed cookie(s) to the current request too, so the Server
  // Components rendered for *this* response see the new access token instead
  // of only the browser getting it for the *next* request.
  for (const cookie of setCookies) {
    const [nameValue] = cookie.split(";");
    const eqIndex = nameValue.indexOf("=");
    if (eqIndex === -1) continue;
    request.cookies.set(nameValue.slice(0, eqIndex).trim(), nameValue.slice(eqIndex + 1).trim());
  }

  const response = intlMiddleware(request);
  for (const cookie of setCookies) {
    response.headers.append("set-cookie", cookie);
  }

  return response;
}

export const config = {
  matcher: [
    // next-intl needs to see nearly every route to attach locale info, but
    // not static assets, Next internals, or files with an extension.
    "/((?!api|_next|_vercel|.*\\..*).*)",
  ],
};
