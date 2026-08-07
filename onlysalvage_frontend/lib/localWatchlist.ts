// Client-only "watchlist" persistence for visitors who aren't logged in.
// Logged-in likes are stored server-side (see lib/api.ts likeListing/unlikeListing);
// this is purely a per-browser fallback so anonymous visitors can still build a
// watchlist that survives page reloads, without it counting toward the public
// likes_count shown on listings.

const STORAGE_KEY = "onlysalvage_watchlist";

function readIds(): number[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "number") : [];
  } catch {
    return [];
  }
}

function writeIds(ids: number[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

export function getLocalWatchlist(): number[] {
  return readIds();
}

export function isLocallyLiked(listingId: number): boolean {
  return readIds().includes(listingId);
}

export function addLocalLike(listingId: number) {
  const ids = readIds();
  if (!ids.includes(listingId)) writeIds([...ids, listingId]);
}

export function removeLocalLike(listingId: number) {
  writeIds(readIds().filter((id) => id !== listingId));
}
