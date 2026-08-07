// Client-only persistence for the inventory browse page's grid layout
// toggle (list/compact/large) -- purely a per-browser cosmetic preference,
// so plain localStorage rather than round-tripping it through the account
// the way a real setting would.
const STORAGE_KEY = "onlysalvage_inventory_view_mode";

export type InventoryViewMode = "list" | "compact" | "large";

export function getInventoryViewMode(): InventoryViewMode | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return raw === "list" || raw === "compact" || raw === "large" ? raw : null;
}

export function setInventoryViewMode(mode: InventoryViewMode) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, mode);
}
