'use client';

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';

/**
 * Client-side trader bookmarking. Persists in localStorage under
 * `infohub:trader-bookmarks` as an array of TraderBookmark records keyed
 * by lowercase address. Dispatches a CustomEvent so multiple tabs/components
 * stay in sync without prop-drilling.
 */

export interface TraderBookmark {
  address: string;        // always lowercase
  displayName?: string | null;
  venues?: string[];      // informational: which platforms they're active on
  addedAt: number;        // epoch ms
  /** Optional note the user adds */
  note?: string;
}

const STORAGE_KEY = 'infohub:trader-bookmarks';
const EVENT_NAME = 'infohub:bookmarks-changed';
const MAX_BOOKMARKS = 100;

function readFromStorage(): TraderBookmark[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (b): b is TraderBookmark =>
        b && typeof b.address === 'string' && /^0x[a-f0-9]{40}$/.test(b.address),
    );
  } catch { return []; }
}

function writeToStorage(list: TraderBookmark[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent(EVENT_NAME));
  } catch { /* quota, private mode, etc. — fail silent */ }
}

// useSyncExternalStore-compatible subscribe function
function subscribe(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = () => callback();
  window.addEventListener(EVENT_NAME, handler);
  window.addEventListener('storage', handler); // cross-tab sync
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

export function useTraderBookmarks() {
  // Read via useSyncExternalStore so every consumer stays in sync when
  // any consumer adds/removes a bookmark.
  const stored = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // useMemo keyed on the underlying JSON string so the returned array
  // identity stays stable across renders. Was an IIFE that produced a
  // fresh `[]` array every call — useTraderAlerts has `[enabled, bookmarks]`
  // in its effect deps, so every parent re-render tore down the 2-minute
  // poll and re-fired pollOnce() (which fans out to /api/hl-traders/[addr]
  // per bookmark). An active user with 20 bookmarks easily blew through
  // HL's rate limit just by rendering the top nav repeatedly.
  const bookmarks: TraderBookmark[] = useMemo(() => {
    try {
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }, [stored]);

  const isBookmarked = useCallback((address: string): boolean => {
    const lc = address.toLowerCase();
    return bookmarks.some(b => b.address === lc);
  }, [bookmarks]);

  const add = useCallback((b: Omit<TraderBookmark, 'addedAt'>) => {
    const lc = b.address.toLowerCase();
    if (!/^0x[a-f0-9]{40}$/.test(lc)) return;
    const existing = readFromStorage();
    if (existing.some(x => x.address === lc)) return; // already bookmarked
    const next = [
      { ...b, address: lc, addedAt: Date.now() },
      ...existing,
    ].slice(0, MAX_BOOKMARKS);
    writeToStorage(next);
  }, []);

  const remove = useCallback((address: string) => {
    const lc = address.toLowerCase();
    const existing = readFromStorage();
    const next = existing.filter(x => x.address !== lc);
    writeToStorage(next);
  }, []);

  const toggle = useCallback((b: Omit<TraderBookmark, 'addedAt'>) => {
    const lc = b.address.toLowerCase();
    const existing = readFromStorage();
    if (existing.some(x => x.address === lc)) {
      writeToStorage(existing.filter(x => x.address !== lc));
    } else {
      const next = [
        { ...b, address: lc, addedAt: Date.now() },
        ...existing,
      ].slice(0, MAX_BOOKMARKS);
      writeToStorage(next);
    }
  }, []);

  const clear = useCallback(() => {
    writeToStorage([]);
  }, []);

  /** Set or clear a free-text note on an existing bookmark. Does nothing if
   *  the address isn't already bookmarked — you can't annotate an unstarred
   *  trader. */
  const updateNote = useCallback((address: string, note: string) => {
    const lc = address.toLowerCase();
    const existing = readFromStorage();
    const idx = existing.findIndex(x => x.address === lc);
    if (idx === -1) return;
    const trimmed = note.trim();
    const next = [...existing];
    next[idx] = { ...next[idx], note: trimmed || undefined };
    writeToStorage(next);
  }, []);

  return { bookmarks, isBookmarked, add, remove, toggle, clear, updateNote };
}
