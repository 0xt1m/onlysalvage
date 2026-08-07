import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";
import { getApiUrl } from "@/lib/apiUrl";
import { slugify } from "@/lib/utils";
import { VEHICLE_TYPES } from "@/lib/types";
import type { ListingSummary, SellerListItem, Make, VehicleModel, CityListing } from "@/lib/types";

const API_URL = getApiUrl();
const MAX_PAGES = 50; // ~5,000 listings at page_size=100 -- generous headroom, avoids a runaway loop

async function getAllActiveListings(): Promise<ListingSummary[]> {
  const listings: ListingSummary[] = [];
  let page = 1;
  let next: string | null = `${API_URL}/inventory/listings/?is_active=true&page_size=100&page=1`;

  while (next && page <= MAX_PAGES) {
    const url: string = next;
    const res: Response = await fetch(url, { cache: "no-store" });
    if (!res.ok) break;
    const data: { results?: ListingSummary[]; next?: string | null } | null = await res.json().catch(() => null);
    if (!data) break;
    listings.push(...(data.results ?? []));
    next = data.next ?? null;
    page += 1;
  }

  return listings;
}

async function getAllSellers(): Promise<SellerListItem[]> {
  const res = await fetch(`${API_URL}/users/sellers/?page_size=200`, { cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json().catch(() => null);
  return data?.results ?? [];
}

async function getAllMakesWithModels(): Promise<{ make: Make; models: VehicleModel[] }[]> {
  const res = await fetch(`${API_URL}/inventory/makes/`, { cache: "no-store" });
  if (!res.ok) return [];
  const makes: Make[] = await res.json().catch(() => []);

  return Promise.all(
    makes.map(async (make) => {
      const modelsRes = await fetch(`${API_URL}/inventory/models/?make=${make.id}`, { cache: "no-store" });
      const models: VehicleModel[] = modelsRes.ok ? await modelsRes.json().catch(() => []) : [];
      return { make, models };
    })
  );
}

async function getAllCities(): Promise<CityListing[]> {
  const res = await fetch(`${API_URL}/inventory/cities/`, { cache: "no-store" });
  if (!res.ok) return [];
  return res.json().catch(() => []);
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [listings, sellers, makesWithModels, cities] = await Promise.all([
    getAllActiveListings(),
    getAllSellers(),
    getAllMakesWithModels(),
    getAllCities(),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/inventory`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${SITE_URL}/makes`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${SITE_URL}/body-styles`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${SITE_URL}/cities`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${SITE_URL}/sellers`, changeFrequency: "daily", priority: 0.6 },
    { url: `${SITE_URL}/sell`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/support`, changeFrequency: "monthly", priority: 0.3 },
  ];

  const makeRoutes: MetadataRoute.Sitemap = makesWithModels.map(({ make }) => ({
    url: `${SITE_URL}/makes/${slugify(make.name)}`,
    changeFrequency: "daily",
    priority: 0.6,
  }));

  const modelRoutes: MetadataRoute.Sitemap = makesWithModels.flatMap(({ make, models }) =>
    models.map((model) => ({
      url: `${SITE_URL}/makes/${slugify(make.name)}/${slugify(model.name)}`,
      changeFrequency: "daily" as const,
      priority: 0.5,
    }))
  );

  const bodyStyleRoutes: MetadataRoute.Sitemap = VEHICLE_TYPES.map((type) => ({
    url: `${SITE_URL}/body-styles/${slugify(type.label)}`,
    changeFrequency: "daily",
    priority: 0.6,
  }));

  const cityRoutes: MetadataRoute.Sitemap = cities.map((city) => ({
    url: `${SITE_URL}/cities/${slugify(city.city)}-${city.state.toLowerCase()}`,
    changeFrequency: "daily",
    priority: 0.6,
  }));

  const listingRoutes: MetadataRoute.Sitemap = listings.map((listing) => ({
    url: `${SITE_URL}/inventory/${listing.slug}`,
    lastModified: listing.created_at,
    changeFrequency: "daily",
    priority: 0.8,
  }));

  const sellerRoutes: MetadataRoute.Sitemap = sellers.map((seller) => ({
    url: `${SITE_URL}/profile/${seller.username}`,
    changeFrequency: "weekly",
    priority: 0.4,
  }));

  return [...staticRoutes, ...makeRoutes, ...modelRoutes, ...bodyStyleRoutes, ...cityRoutes, ...listingRoutes, ...sellerRoutes];
}
