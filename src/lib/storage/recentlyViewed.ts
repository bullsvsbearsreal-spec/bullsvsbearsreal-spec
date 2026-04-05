const STORAGE_KEY = 'infohub-recently-viewed';
const MAX_ITEMS = 12;

export interface RecentItem {
  /** URL path, e.g. "/funding/BTC" or "/open-interest" */
  path: string;
  /** Display label, e.g. "BTC Funding Rates" or "Open Interest" */
  label: string;
  /** Optional symbol for icon display */
  symbol?: string;
  /** Timestamp of last visit */
  ts: number;
}

export function getRecentlyViewed(): RecentItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addRecentlyViewed(path: string, label: string, symbol?: string): void {
  if (typeof window === 'undefined') return;
  try {
    const items = getRecentlyViewed().filter(i => i.path !== path);
    items.unshift({ path, label, symbol, ts: Date.now() });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
  } catch {
    // localStorage full or disabled
  }
}

export function clearRecentlyViewed(): void {
  if (typeof window === 'undefined') return;
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}
