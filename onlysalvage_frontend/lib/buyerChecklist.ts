// Client-only persistence for a visitor's progress through the /checklist
// page. Keyed by real BuyerChecklistItem ids (not positional indices) since
// the checklist content is admin-editable (see checklist/admin.py on the
// backend) and can be reordered or added to at any time -- a positional key
// would silently point a saved "checked" state at the wrong item once that
// happens.

const STORAGE_KEY = "onlysalvage_buyer_checklist";

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

export function getCheckedItemIds(): number[] {
  return readIds();
}

export function setItemChecked(itemId: number, checked: boolean) {
  const ids = readIds();
  if (checked) {
    if (!ids.includes(itemId)) writeIds([...ids, itemId]);
  } else {
    writeIds(ids.filter((id) => id !== itemId));
  }
}

export function clearChecklistProgress() {
  writeIds([]);
}
