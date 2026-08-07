// Client-only "compare" persistence -- like localWatchlist/recentlyViewed,
// this deliberately never touches the backend. Comparing a handful of cars
// side by side is a per-browser scratch list, not something worth an
// account-level feature or a server round-trip to read/write.

const STORAGE_KEY = "onlysalvage_compare";

function readSlugs(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((s) => typeof s === "string") : [];
  } catch {
    return [];
  }
}

function writeSlugs(slugs: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(slugs));
}

export function getCompareList(): string[] {
  return readSlugs();
}

export function isInCompareList(slug: string): boolean {
  return readSlugs().includes(slug);
}

// Returns "ok" | "already" so callers can toast the right message without
// duplicating the readSlugs() check themselves. No cap on how many can be
// added -- the compare page itself scrolls horizontally to fit any number.
export function addToCompareList(slug: string): "ok" | "already" {
  const slugs = readSlugs();
  if (slugs.includes(slug)) return "already";
  writeSlugs([...slugs, slug]);
  return "ok";
}

export function removeFromCompareList(slug: string) {
  writeSlugs(readSlugs().filter((s) => s !== slug));
}
