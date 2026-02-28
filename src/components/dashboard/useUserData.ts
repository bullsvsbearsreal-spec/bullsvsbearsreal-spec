'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface UserData {
  watchlist: string[];
  portfolio: Array<{ symbol: string; qty: number; avgPrice: number }>;
  alerts: Array<{ id?: string; symbol: string; metric: string; operator: string; value: number; enabled?: boolean }>;
  wallets: Array<{ address: string; label?: string }>;
}

const EMPTY: UserData = { watchlist: [], portfolio: [], alerts: [], wallets: [] };

// Module-level cache so all widgets share the same data without duplicate fetches
let cache: { data: UserData; ts: number } | null = null;
let inflight: Promise<UserData> | null = null;
const CACHE_TTL = 10_000; // 10s — prevent duplicate calls on mount

async function fetchUserData(): Promise<UserData> {
  // Return cache if fresh
  if (cache && Date.now() - cache.ts < CACHE_TTL) return cache.data;
  // Deduplicate in-flight requests
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const res = await fetch('/api/user/data');
      if (!res.ok) return EMPTY;
      const raw = await res.json();
      const data: UserData = {
        watchlist: raw.watchlist || [],
        portfolio: raw.portfolio || [],
        alerts: (raw.alerts || []).filter((a: any) => a.enabled !== false),
        wallets: raw.wallets || [],
      };
      cache = { data, ts: Date.now() };
      return data;
    } catch {
      return EMPTY;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

export function useUserData(refreshMs = 60_000) {
  const [data, setData] = useState<UserData | null>(null);
  const mountedRef = useRef(true);

  const load = useCallback(async () => {
    const d = await fetchUserData();
    if (mountedRef.current) setData(d);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    load();
    const iv = setInterval(() => {
      cache = null; // Force fresh fetch
      load();
    }, refreshMs);
    return () => {
      mountedRef.current = false;
      clearInterval(iv);
    };
  }, [load, refreshMs]);

  return data;
}

// Invalidate cache when user makes changes (called from dashboard page after PUT)
export function invalidateUserDataCache() {
  cache = null;
}
