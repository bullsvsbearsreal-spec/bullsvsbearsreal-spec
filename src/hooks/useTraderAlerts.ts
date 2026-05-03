'use client';

import { useEffect, useRef, useState, useCallback, useSyncExternalStore } from 'react';
import { useTraderBookmarks } from './useTraderBookmarks';

/**
 * Browser-only copy-trading alerts.
 *
 * Polls the cross-platform dossier (/api/hl-traders/[address]) for every
 * bookmarked trader every POLL_INTERVAL. Compares the current open-position
 * list against a local snapshot. When positions open/close/resize materially,
 * adds an event to a rolling feed and (optionally) fires a browser Notification.
 *
 * No backend required — 100% client-side. Suitable as an MVP; a real
 * production setup would move polling to a cron + fanout to email/TG/Discord.
 */

export type AlertKind = 'opened' | 'closed' | 'increased' | 'decreased' | 'flipped';

export interface TraderAlert {
  id: string;                    // unique: address-coin-timestamp
  address: string;
  displayName: string | null;
  coin: string;
  kind: AlertKind;
  details: string;               // human-readable blurb
  sizeUsd: number;
  isLong: boolean;
  timestamp: number;
}

interface TraderSnapshot {
  address: string;
  fetchedAt: number;
  positions: Array<{ coin: string; isLong: boolean; sizeUsd: number }>;
}

const SNAPSHOT_KEY = 'infohub:trader-alerts-snapshots';
const FEED_KEY = 'infohub:trader-alerts-feed';
const EVENT = 'infohub:trader-alerts-changed';
const POLL_INTERVAL = 120_000;   // 2 min — respect HL rate limits
const SIZE_CHANGE_THRESHOLD = 0.10; // 10% of position size — ignore tiny re-margins
const MAX_FEED = 50;
const SETTINGS_KEY = 'infohub:trader-alerts-enabled';

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch { return fallback; }
}

function writeJson(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent(EVENT));
  } catch { /* ignore quota */ }
}

function subscribe(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const h = () => cb();
  window.addEventListener(EVENT, h);
  window.addEventListener('storage', h);
  return () => {
    window.removeEventListener(EVENT, h);
    window.removeEventListener('storage', h);
  };
}

function getFeedSnapshot(): string {
  if (typeof window === 'undefined') return '[]';
  return window.localStorage.getItem(FEED_KEY) ?? '[]';
}
function getFeedServerSnapshot(): string { return '[]'; }

function getSettingsSnapshot(): string {
  if (typeof window === 'undefined') return 'false';
  return window.localStorage.getItem(SETTINGS_KEY) ?? 'false';
}
function getSettingsServerSnapshot(): string { return 'false'; }

async function fetchPositions(address: string): Promise<TraderSnapshot['positions']> {
  try {
    const res = await fetch(`/api/hl-traders/${address}`, { signal: AbortSignal.timeout(8_000) });
    if (!res.ok) return [];
    const json = await res.json();
    const positions: any[] = json?.openPositions ?? [];
    return positions.map(p => ({
      coin: p.coin,
      isLong: !!p.isLong,
      sizeUsd: Number(p.sizeUsd) || 0,
    }));
  } catch { return []; }
}

function diffPositions(
  prev: TraderSnapshot['positions'],
  curr: TraderSnapshot['positions'],
): Array<{ kind: AlertKind; coin: string; isLong: boolean; sizeUsd: number; details: string }> {
  const changes: Array<{ kind: AlertKind; coin: string; isLong: boolean; sizeUsd: number; details: string }> = [];
  const prevByCoin = new Map(prev.map(p => [p.coin, p]));
  const currByCoin = new Map(curr.map(p => [p.coin, p]));

  // Coins in curr but not prev → opened
  currByCoin.forEach((p, coin) => {
    const before = prevByCoin.get(coin);
    if (!before) {
      changes.push({
        kind: 'opened',
        coin,
        isLong: p.isLong,
        sizeUsd: p.sizeUsd,
        details: `opened ${p.isLong ? 'LONG' : 'SHORT'} ${coin} · ${fmtCompact(p.sizeUsd)}`,
      });
      return;
    }
    // Side flipped?
    if (before.isLong !== p.isLong) {
      changes.push({
        kind: 'flipped',
        coin,
        isLong: p.isLong,
        sizeUsd: p.sizeUsd,
        details: `flipped ${p.isLong ? 'LONG' : 'SHORT'} on ${coin} · ${fmtCompact(p.sizeUsd)}`,
      });
      return;
    }
    // Size changed materially?
    const delta = p.sizeUsd - before.sizeUsd;
    const pctChange = before.sizeUsd > 0 ? Math.abs(delta) / before.sizeUsd : 1;
    if (pctChange >= SIZE_CHANGE_THRESHOLD) {
      const kind: AlertKind = delta > 0 ? 'increased' : 'decreased';
      changes.push({
        kind,
        coin,
        isLong: p.isLong,
        sizeUsd: p.sizeUsd,
        details: `${kind} ${coin} by ${fmtCompact(Math.abs(delta))} (now ${fmtCompact(p.sizeUsd)})`,
      });
    }
  });

  // Coins in prev but not curr → closed
  prevByCoin.forEach((p, coin) => {
    if (!currByCoin.has(coin)) {
      changes.push({
        kind: 'closed',
        coin,
        isLong: p.isLong,
        sizeUsd: p.sizeUsd,
        details: `closed ${p.isLong ? 'LONG' : 'SHORT'} ${coin} · was ${fmtCompact(p.sizeUsd)}`,
      });
    }
  });

  return changes;
}

function fmtCompact(n: number): string {
  if (!Number.isFinite(n) || n === 0) return '$0';
  const abs = Math.abs(n);
  if (abs >= 1e9) return `$${(abs / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `$${(abs / 1e3).toFixed(0)}K`;
  return `$${abs.toFixed(0)}`;
}

export function useTraderAlerts() {
  const { bookmarks } = useTraderBookmarks();
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const [lastCheck, setLastCheck] = useState<number | null>(null);

  const storedFeed = useSyncExternalStore(subscribe, getFeedSnapshot, getFeedServerSnapshot);
  const storedEnabled = useSyncExternalStore(subscribe, getSettingsSnapshot, getSettingsServerSnapshot);

  const feed: TraderAlert[] = (() => {
    try {
      const parsed = JSON.parse(storedFeed);
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  })();

  const enabled = storedEnabled === 'true';

  const clearFeed = useCallback(() => {
    writeJson(FEED_KEY, []);
  }, []);

  const toggleEnabled = useCallback(async () => {
    const next = !enabled;
    if (next && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      // Ask for permission when user opts in. User may deny — we still flip
      // the flag on; detection still runs, just no browser notif.
      try { await Notification.requestPermission(); } catch { /* ignore */ }
    }
    window.localStorage.setItem(SETTINGS_KEY, String(next));
    window.dispatchEvent(new CustomEvent(EVENT));
  }, [enabled]);

  // Poll every POLL_INTERVAL when enabled AND there are bookmarks
  useEffect(() => {
    if (!enabled || bookmarks.length === 0) {
      if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
      return;
    }

    async function pollOnce() {
      const snapshots: Record<string, TraderSnapshot> = readJson(SNAPSHOT_KEY, {});
      const freshAlerts: TraderAlert[] = [];
      for (const b of bookmarks) {
        const positions = await fetchPositions(b.address);
        const prev = snapshots[b.address];
        if (prev) {
          const changes = diffPositions(prev.positions, positions);
          for (const c of changes) {
            freshAlerts.push({
              id: `${b.address}-${c.coin}-${Date.now()}`,
              address: b.address,
              displayName: b.displayName ?? null,
              coin: c.coin,
              kind: c.kind,
              details: c.details,
              sizeUsd: c.sizeUsd,
              isLong: c.isLong,
              timestamp: Date.now(),
            });
          }
        }
        snapshots[b.address] = { address: b.address, fetchedAt: Date.now(), positions };
      }
      writeJson(SNAPSHOT_KEY, snapshots);

      if (freshAlerts.length > 0) {
        const existing: TraderAlert[] = readJson(FEED_KEY, []);
        const combined = [...freshAlerts, ...existing].slice(0, MAX_FEED);
        writeJson(FEED_KEY, combined);

        // Fire browser notification if permitted — one per alert, throttled
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          // Cap notifications to 3 per poll to avoid spam
          for (const a of freshAlerts.slice(0, 3)) {
            try {
              new Notification(`${a.displayName || a.address.slice(0, 10)}...`, {
                body: a.details,
                tag: `${a.address}-${a.coin}`, // dedupe rapid repeats on same coin
              });
            } catch { /* browsers may limit — ignore */ }
          }
        }
      }
      setLastCheck(Date.now());
    }

    // Fire immediately (seed snapshots), then interval
    pollOnce();
    pollingRef.current = setInterval(pollOnce, POLL_INTERVAL);
    return () => {
      if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
    };
  }, [enabled, bookmarks]);

  return { feed, clearFeed, enabled, toggleEnabled, lastCheck };
}
