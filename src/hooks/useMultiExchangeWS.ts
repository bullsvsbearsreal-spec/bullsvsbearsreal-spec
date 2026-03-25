'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export interface WSPrice {
  exchange: string;
  symbol: string;
  price: number;
  bid: number;
  ask: number;
  ts: number;
}

type PriceMap = Record<string, WSPrice>;

export type PriceSnapshot = { t: number; prices: Record<string, number> };

const MAX_HISTORY = 2000;
const POLL_INTERVAL = 2_000; // 2s — proxied through Vercel to avoid mixed content
const SNAPSHOT_INTERVAL = 3_000;
const STALE_MS = 20_000;

export function useMultiExchangeWS(symbol: string, exchanges: string[], enabled = true) {
  const [prices, setPrices] = useState<PriceMap>({});
  const [connected, setConnected] = useState<Record<string, boolean>>({});
  const [history, setHistory] = useState<PriceSnapshot[]>([]);
  const exchangeKey = exchanges.join(',');
  const pricesRef = useRef<PriceMap>({});
  const historyRef = useRef<PriceSnapshot[]>([]);
  const rafId = useRef<number>(0);
  const pendingUpdate = useRef(false);
  // Use Vercel proxy to avoid HTTPS→HTTP mixed content block

  const scheduleBatchUpdate = useCallback(() => {
    if (pendingUpdate.current) return;
    pendingUpdate.current = true;
    rafId.current = requestAnimationFrame(() => {
      setPrices({ ...pricesRef.current });
      pendingUpdate.current = false;
    });
  }, []);

  const handlePrice = useCallback((exchange: string, sym: string, price: number, bid: number, ask: number, ts: number) => {
    pricesRef.current[exchange] = { exchange, symbol: sym, price, bid, ask, ts };
    scheduleBatchUpdate();
  }, [scheduleBatchUpdate]);

  useEffect(() => {
    if (!enabled || !symbol) return;
    let aborted = false;

    const poll = () => {
      if (aborted) return;
      const now = Date.now();

      fetch(`/api/prices?symbol=${symbol}`, { signal: AbortSignal.timeout(5000) })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (aborted || !data?.data?.[symbol]) return;
          const exPrices = data.data[symbol];
          const found = new Set<string>();

          for (const [ex, info] of Object.entries(exPrices) as [string, any][]) {
            if (!exchanges.includes(ex)) continue;
            if (info.price > 0) {
              handlePrice(ex, symbol, info.price, info.bid || info.price, info.ask || info.price, info.ts || now);
              found.add(ex);
            }
          }

          // Update connected state only if changed
          setConnected(prev => {
            let changed = false;
            for (const e of exchanges) {
              if (prev[e] !== found.has(e)) { changed = true; break; }
            }
            if (!changed) return prev;
            const next: Record<string, boolean> = {};
            for (const e of exchanges) next[e] = found.has(e);
            return next;
          });
        })
        .catch(() => {});
    };

    poll();
    const pollTimer = setInterval(poll, POLL_INTERVAL);

    // Snapshot for chart history
    historyRef.current = [];
    setHistory([]);
    const historyTimer = setInterval(() => {
      const now = Date.now();
      const current = pricesRef.current;
      const priceMap: Record<string, number> = {};
      let hasAny = false;
      for (const [ex, p] of Object.entries(current)) {
        if (p.price > 0 && (now - p.ts) < STALE_MS) {
          priceMap[ex] = p.price;
          hasAny = true;
        }
      }
      if (hasAny) {
        const snap: PriceSnapshot = { t: now, prices: priceMap };
        historyRef.current.push(snap);
        if (historyRef.current.length > MAX_HISTORY) historyRef.current.shift();
        setHistory([...historyRef.current]);
      }
    }, SNAPSHOT_INTERVAL);

    return () => {
      aborted = true;
      pricesRef.current = {};
      pendingUpdate.current = false;
      cancelAnimationFrame(rafId.current);
      clearInterval(pollTimer);
      clearInterval(historyTimer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, exchangeKey, enabled, handlePrice]);

  return { prices, connected, history };
}
