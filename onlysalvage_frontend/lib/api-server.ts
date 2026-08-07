import { serverFetch } from "./server-fetch";
import type { Listing, ListingSummary, TopRatedSeller, SellerListItem, Make, VehicleModel, CityListing, ApiKeyStatus, BuyerChecklistCategory } from "./types";

export async function getMeServer() {
  const res = await serverFetch("/auth/me/");
  if (!res.ok) return null;
  return res.json();
}

export async function getApiKeyStatusServer(): Promise<ApiKeyStatus | null> {
  const res = await serverFetch("/auth/me/api-key/");
  if (!res.ok) return null;
  return res.json().catch(() => null);
}

// Cookie-forwarding counterparts of getListing()/getListings() in lib/api.ts,
// for use in Server Components -- without these, likes_count/is_liked would
// always reflect an anonymous request even when the visitor is logged in.
export async function getListingServer(slug: string): Promise<Listing | null> {
  const res = await serverFetch(`/inventory/listings/${slug}/`);
  if (!res.ok) return null;
  return res.json();
}

// Cookie-forwarding counterpart of getListingsBySeller() in lib/api.ts, for
// the one place that needs to see a seller's *own* is_active=false (paused)
// listings alongside their active ones -- the profile page's "My Listings"
// section, once it's confirmed (via this same auth cookie) that the viewer
// really is that seller. Deliberately doesn't go through getListingsServer,
// which always defaults to is_active=true -- there's no way to ask that one
// for "don't filter by is_active at all". The backend only actually honors
// the omission for this exact request shape anyway (seller_id matching the
// authenticated user -- see ListingViewSet.get_queryset); everyone else's
// paused listings stay filtered out regardless of what a caller asks for.
export async function getListingsBySellerServer(sellerId: number): Promise<ListingSummary[]> {
  const res = await serverFetch(`/inventory/listings/?seller_id=${sellerId}`);
  if (!res.ok) return [];
  const data = await res.json().catch(() => null);
  const results = (data?.results ?? []) as ListingSummary[];
  // Paused listings read as archival (see ListingCard's Inactive badge and
  // opacity treatment) -- they belong at the end of the owner's own list,
  // not interspersed by recency among the ones actually for sale. A stable
  // sort keeps every other ordering (recency, promoted-first, etc.) intact
  // within each of the two groups.
  return results.slice().sort((a, b) => Number(!a.is_active) - Number(!b.is_active));
}

export async function getListingsServer(params: Record<string, string> = {}) {
  const query = new URLSearchParams({ is_active: "true", ...params });
  const res = await serverFetch(`/inventory/listings/?${query.toString()}`);
  if (!res.ok) return { results: [] as ListingSummary[], count: 0 };
  const data = await res.json().catch(() => null);
  return {
    results: (data?.results ?? []) as ListingSummary[],
    count: (data?.count ?? 0) as number,
  };
}

export async function getTopRatedSellersServer(limit = 6): Promise<TopRatedSeller[]> {
  const res = await serverFetch(`/users/top-rated/?limit=${limit}`);
  if (!res.ok) return [];
  return res.json().catch(() => []);
}

export async function getVerifiedSellersServer(limit = 6): Promise<TopRatedSeller[]> {
  const res = await serverFetch(`/users/verified/?limit=${limit}`);
  if (!res.ok) return [];
  return res.json().catch(() => []);
}

export async function getFeaturedListingsServer(limit = 6): Promise<ListingSummary[]> {
  const res = await serverFetch(`/inventory/listings/featured/?limit=${limit}`);
  if (!res.ok) return [];
  return res.json().catch(() => []);
}

export async function getMostLikedListingsServer(limit = 6): Promise<ListingSummary[]> {
  const res = await serverFetch(`/inventory/listings/most-liked/?limit=${limit}`);
  if (!res.ok) return [];
  return res.json().catch(() => []);
}

export async function getMostViewedListingsServer(limit = 6): Promise<ListingSummary[]> {
  const res = await serverFetch(`/inventory/listings/most-viewed/?limit=${limit}`);
  if (!res.ok) return [];
  return res.json().catch(() => []);
}

// Empty for anonymous visitors or anyone with no search/view history yet --
// callers should just skip rendering the section rather than showing an error.
export async function getRecommendedListingsServer(limit = 8): Promise<ListingSummary[]> {
  const res = await serverFetch(`/inventory/listings/recommended/?limit=${limit}`);
  if (!res.ok) return [];
  return res.json().catch(() => []);
}

export async function getSimilarListingsServer(slug: string, limit = 4): Promise<ListingSummary[]> {
  const res = await serverFetch(`/inventory/listings/${slug}/similar/?limit=${limit}`);
  if (!res.ok) return [];
  return res.json().catch(() => []);
}

export async function getMakesServer(): Promise<Make[]> {
  const res = await serverFetch(`/inventory/makes/`);
  if (!res.ok) return [];
  return res.json().catch(() => []);
}

export async function getModelsServer(makeId: number): Promise<VehicleModel[]> {
  const res = await serverFetch(`/inventory/models/?make=${makeId}`);
  if (!res.ok) return [];
  return res.json().catch(() => []);
}

export async function getCitiesServer(): Promise<CityListing[]> {
  const res = await serverFetch(`/inventory/cities/`);
  if (!res.ok) return [];
  return res.json().catch(() => []);
}

// Body-style codes (e.g. "SDN", "SUV") that at least one active listing
// actually has -- lets the home/body-styles pages skip linking to a style
// with nothing to show, instead of listing every VEHICLE_TYPES entry blind.
export async function getVehicleTypesWithListingsServer(): Promise<string[]> {
  const res = await serverFetch(`/inventory/vehicle-types/`);
  if (!res.ok) return [];
  return res.json().catch(() => []);
}

export async function getBuyerChecklistServer(locale: string): Promise<BuyerChecklistCategory[]> {
  const res = await serverFetch(`/checklist/?locale=${locale}`);
  if (!res.ok) return [];
  return res.json().catch(() => []);
}

export async function getSellersServer(params: Record<string, string> = {}) {
  const query = new URLSearchParams(params);
  const res = await serverFetch(`/users/sellers/?${query.toString()}`);
  if (!res.ok) return { results: [] as SellerListItem[], count: 0 };
  const data = await res.json().catch(() => null);
  return {
    results: (data?.results ?? []) as SellerListItem[],
    count: (data?.count ?? 0) as number,
  };
}