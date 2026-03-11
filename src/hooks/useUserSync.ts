'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';

/**
 * localStorage keys that we sync to the database for logged-in users.
 * Maps each key to its DB field name in the user_prefs JSONB blob.
 */
const SYNC_KEYS: Record<string, string> = {
  ih_watchlist: 'watchlist',
  ih_portfolio: 'portfolio',
  ih_alerts: 'alerts',
  ih_screener_presets: 'screenerPresets',
  ih_wallets: 'wallets',
  ih_notification_prefs: 'notificationPrefs',
  'infohub-theme': 'theme',
  ih_funding_prefs: 'fundingPrefs',
};

/**
 * Collects all synced localStorage data into one object.
 */
function collectLocalData(): Record<string, any> {
  const data: Record<string, any> = {};
  for (const [lsKey, dbField] of Object.entries(SYNC_KEYS)) {
    try {
      const raw = localStorage.getItem(lsKey);
      if (raw) data[dbField] = JSON.parse(raw);
    } catch {
      // skip corrupt data
    }
  }
  return data;
}

/**
 * Writes synced DB data to localStorage.
 */
function applyRemoteData(data: Record<string, any>): void {
  for (const [lsKey, dbField] of Object.entries(SYNC_KEYS)) {
    const value = data[dbField];
    if (value !== undefined && value !== null) {
      try {
        localStorage.setItem(lsKey, JSON.stringify(value));
      } catch {
        // localStorage full
      }
    }
  }
}

/**
 * Merges local + remote data, preferring whichever has more items for arrays.
 * For non-array values, remote wins.
 */
function mergeData(
  local: Record<string, any>,
  remote: Record<string, any>,
): Record<string, any> {
  const merged: Record<string, any> = { ...remote };
  for (const key of Object.keys(local)) {
    const localVal = local[key];
    const remoteVal = remote[key];

    if (Array.isArray(localVal) && Array.isArray(remoteVal)) {
      // For watchlists: union of unique strings
      if (key === 'watchlist') {
        merged[key] = Array.from(new Set([...remoteVal, ...localVal]));
      }
      // For portfolio/alerts/wallets: merge by identifier, prefer remote for conflicts
      else if (key === 'portfolio') {
        const remoteSymbols = new Set(remoteVal.map((h: any) => h.symbol));
        merged[key] = [
          ...remoteVal,
          ...localVal.filter((h: any) => !remoteSymbols.has(h.symbol)),
        ];
      } else if (key === 'alerts') {
        const remoteIds = new Set(remoteVal.map((a: any) => a.id));
        merged[key] = [
          ...remoteVal,
          ...localVal.filter((a: any) => !remoteIds.has(a.id)),
        ];
      } else if (key === 'wallets') {
        const remoteAddrs = new Set(
          remoteVal.map((w: any) => w.address?.toLowerCase()),
        );
        merged[key] = [
          ...remoteVal,
          ...localVal.filter(
            (w: any) => !remoteAddrs.has(w.address?.toLowerCase()),
          ),
        ];
      } else {
        // For screener presets: union by name
        const remoteNames = new Set(remoteVal.map((p: any) => p.name));
        merged[key] = [
          ...remoteVal,
          ...localVal.filter((p: any) => !remoteNames.has(p.name)),
        ];
      }
    } else if (remoteVal === undefined || remoteVal === null) {
      // Remote has nothing — use local
      merged[key] = localVal;
    } else if (
      typeof localVal === 'object' && localVal !== null && !Array.isArray(localVal) &&
      typeof remoteVal === 'object' && remoteVal !== null && !Array.isArray(remoteVal)
    ) {
      // For plain objects (e.g. fundingPrefs, notificationPrefs): merge at key level,
      // local values override remote so recent local changes aren't lost on login sync
      merged[key] = { ...remoteVal, ...localVal };
    }
    // Otherwise remote wins (already in merged from spread)
  }
  return merged;
}

/**
 * Hook: syncs localStorage data ↔ database for logged-in users.
 *
 * On login:
 *   1. Pulls remote data from DB
 *   2. Merges with local data (union)
 *   3. Writes merged result to both DB and localStorage
 *
 * On mutation (via storage event or manual trigger):
 *   - Debounced push to DB
 *
 * For non-authenticated users: does nothing (localStorage works as before).
 */
export function useUserSync() {
  const { data: session, status } = useSession();
  const syncedRef = useRef(false);
  const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Push current localStorage data to the DB
  const pushToRemote = useCallback(async () => {
    if (!session?.user?.id) return;
    try {
      const data = collectLocalData();
      await fetch('/api/user/data', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    } catch {
      // silently fail — next mutation will retry
    }
  }, [session?.user?.id]);

  // Debounced push — call this after any localStorage mutation
  const debouncedPush = useCallback(() => {
    if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    pushTimerRef.current = setTimeout(pushToRemote, 2000);
  }, [pushToRemote]);

  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => {
      if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    };
  }, []);

  // Initial sync on login
  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.id || syncedRef.current) return;

    (async () => {
      try {
        const res = await fetch('/api/user/data');
        if (!res.ok) return;
        const remoteData = await res.json();

        const localData = collectLocalData();

        // If remote is empty, just push local data up
        if (Object.keys(remoteData).length === 0) {
          if (Object.keys(localData).length > 0) {
            await fetch('/api/user/data', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(localData),
            });
          }
        } else {
          // Merge and write to both sides
          const merged = mergeData(localData, remoteData);
          applyRemoteData(merged);
          await fetch('/api/user/data', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(merged),
          });
        }

        // Dispatch a custom event so pages re-read from localStorage
        window.dispatchEvent(new Event('user-data-synced'));
      } catch {
        // sync failed — localStorage still works
      }

      syncedRef.current = true;
    })();
  }, [status, session?.user?.id]);

  // Listen to localStorage changes (from this tab or other tabs)
  useEffect(() => {
    if (status !== 'authenticated') return;

    const handleStorage = (e: StorageEvent) => {
      if (e.key && Object.keys(SYNC_KEYS).includes(e.key)) {
        debouncedPush();
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [status, debouncedPush]);

  // Store the true original setItem once to prevent stacking wrappers on re-renders
  const originalSetItemRef = useRef<((key: string, value: string) => void) | null>(null);

  // Patch localStorage.setItem to detect same-tab mutations
  useEffect(() => {
    // Capture the real setItem only once (before any patching)
    if (!originalSetItemRef.current) {
      originalSetItemRef.current = localStorage.setItem.bind(localStorage);
    }
    const original = originalSetItemRef.current;

    // Only patch when authenticated — but ALWAYS return cleanup so the patch
    // is removed when status changes to 'loading'/'unauthenticated'.
    // Previously, early-returning without cleanup left a stale patch in place
    // that pushed to a null user after logout.
    if (status === 'authenticated') {
      localStorage.setItem = (key: string, value: string) => {
        original(key, value);
        if (Object.keys(SYNC_KEYS).includes(key)) {
          debouncedPush();
        }
      };
    }

    return () => {
      localStorage.setItem = original;
    };
  }, [status, debouncedPush]);

  return { pushToRemote };
}
