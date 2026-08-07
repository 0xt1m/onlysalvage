// Client-only "recently viewed" persistence, used to power a "Because you
// viewed X" fallback recommendation section for visitors who aren't logged
// in (logged-in users get server-side recommendations from their tracked
// search/view history instead -- see getRecommendedListingsServer).

const STORAGE_KEY = "onlysalvage_recently_viewed";
const MAX_ENTRIES = 10;

export interface RecentlyViewedEntry {
  slug: string;
  title: string;
}

function readEntries(): RecentlyViewedEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((e) => e && typeof e.slug === "string" && typeof e.title === "string")
      : [];
  } catch {
    return [];
  }
}

function writeEntries(entries: RecentlyViewedEntry[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export function getRecentlyViewed(): RecentlyViewedEntry[] {
  return readEntries();
}

export function addRecentlyViewed(entry: RecentlyViewedEntry) {
  const rest = readEntries().filter((e) => e.slug !== entry.slug);
  writeEntries([entry, ...rest].slice(0, MAX_ENTRIES));
}
