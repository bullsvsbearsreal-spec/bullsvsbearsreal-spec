'use client';

import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';

/**
 * Tracks recently viewed traders (by address) in localStorage. Distinct from
 * bookmarks — this is passive browsing history that auto-populates as users
 * navigate into `/trader/[address]` pages. Most-recent first. Capped at 20.
 */

export interface RecentTrader {
  address: string;
  displayName?: string | null;
  visitedAt: number;
}

const STORAGE_KEY = 'infohub:recent-traders';
const EVENT_NAME = 'infohub:recent-traders-changed';
const MAX_RECENT = 20;

function readFromStorage(): RecentTrader[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (r): r is RecentTrader =>
        r && typeof r.address === 'string' && /^0x[a-f0-9]{40}$/.test(r.address),
    );
  } catch { return []; }
}

function writeToStorage(list: RecentTrader[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent(EVENT_NAME));
  } catch { /* fail silent — quota, private mode, etc. */ }
}

function subscribe(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = () => cb();
  window.addEventListener(EVENT_NAME, handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener(EVENT_NAME, handler);
    window.removeEventListener('storage', handler);
  };
}

function getSnapshot(): string {
  if (typeof window === 'undefined') return '[]';
  return window.localStorage.getItem(STORAGE_KEY) ?? '[]';
}

function getServerSnapshot(): string {
  return '[]';
}

export function useRecentTraders() {
  const stored = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // useMemo keyed on the stored string so identity stays stable across
  // renders. Same fix as useTraderBookmarks — consumers (smart-money page,
  // trader-watch page) use `recents` in useMemo/useEffect deps. Without
  // this, every parent re-render produced a fresh array reference,
  // tearing down child effects unnecessarily and recomputing filters.
  const recents: RecentTrader[] = useMemo(() => {
    try {
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }, [stored]);

  /** Record a trader visit — dedupes existing entries and moves to front.
   *  Skip if rate-limited (debounce window) so rapid re-renders don't spam. */
  const record = useCallback((address: string, displayName?: string | null) => {
    const lc = address.toLowerCase();
    if (!/^0x[a-f0-9]{40}$/.test(lc)) return;
    const existing = readFromStorage();
    const existingIdx = existing.findIndex(r => r.address === lc);
    // Debounce: if the same trader was viewed within the last 10s, skip
    if (existingIdx === 0 && Date.now() - existing[0].visitedAt < 10_000) return;
    const without = existing.filter(r => r.address !== lc);
    const next = [
      { address: lc, displayName: displayName ?? existing[existingIdx]?.displayName ?? null, visitedAt: Date.now() },
      ...without,
    ].slice(0, MAX_RECENT);
    writeToStorage(next);
  }, []);

  const remove = useCallback((address: string) => {
    const lc = address.toLowerCase();
    writeToStorage(readFromStorage().filter(r => r.address !== lc));
  }, []);

  const clear = useCallback(() => {
    writeToStorage([]);
  }, []);

  return { recents, record, remove, clear };
}

/**
 * Convenience: auto-record on mount. Drop this inside a page component that
 * renders a single trader.
 */
export function useRecordTraderVisit(address: string | null, displayName?: string | null) {
  const { record } = useRecentTraders();
  useEffect(() => {
    if (!address) return;
    record(address, displayName);
  }, [address, displayName, record]);
}
