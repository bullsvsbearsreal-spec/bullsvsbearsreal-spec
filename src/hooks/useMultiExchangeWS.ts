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
const POLL_INTERVAL = 2_000; // 2 seconds — fast enough for spread comparison
const SNAPSHOT_INTERVAL = 3_000; // chart history every 3s
const STALE_MS = 20_000; // prices older than 20s are excluded from spread

// Exchanges whose prices come from /api/funding (markPrice) instead of /api/tickers
const FUNDING_EXCHANGES = new Set(['gTrade', 'GMX']);

export function useMultiExchangeWS(symbol: string, exchanges: string[], enabled = true) {
  const [prices, setPrices] = useState<PriceMap>({});
  const [connected, setConnected] = useState<Record<string, boolean>>({});
  const [history, setHistory] = useState<PriceSnapshot[]>([]);
  const exchangeKey = exchanges.join(',');
  const pricesRef = useRef<PriceMap>({});
  const historyRef = useRef<PriceSnapshot[]>([]);
  const pendingUpdate = useRef(false);

  // Batch state updates — flush on next animation frame
  const scheduleBatchUpdate = useCallback(() => {
    if (pendingUpdate.current) return;
    pendingUpdate.current = true;
    requestAnimationFrame(() => {
      setPrices({ ...pricesRef.current });
      pendingUpdate.current = false;
    });
  }, []);

  const handlePrice = useCallback((p: WSPrice) => {
    pricesRef.current[p.exchange] = p;
    scheduleBatchUpdate();
  }, [scheduleBatchUpdate]);

  useEffect(() => {
    if (!enabled || !symbol) return;

    const tickerExchanges = exchanges.filter(e => !FUNDING_EXCHANGES.has(e));
    const fundingExchanges = exchanges.filter(e => FUNDING_EXCHANGES.has(e));
    let aborted = false;

    const poll = () => {
      if (aborted) return;
      const now = Date.now();

      // Fetch tickers + funding in parallel
      const promises: Promise<void>[] = [];

      if (tickerExchanges.length > 0) {
        promises.push(
          fetch('/api/tickers')
            .then(r => r.ok ? r.json() : null)
            .then(json => {
              if (aborted) return;
              const tickers: any[] = json?.data || json || [];
              const found = new Set<string>();
              for (const t of tickers) {
                if (t.symbol === symbol && exchanges.includes(t.exchange) && t.lastPrice > 0) {
                  handlePrice({
                    exchange: t.exchange, symbol, price: t.lastPrice,
                    bid: t.lastPrice, ask: t.lastPrice, ts: t.fetchedAt || now,
                  });
                  found.add(t.exchange);
                }
              }
              setConnected(prev => {
                const next = { ...prev };
                for (const e of tickerExchanges) next[e] = found.has(e);
                return next;
              });
            })
            .catch(() => {})
        );
      }

      if (fundingExchanges.length > 0) {
        promises.push(
          fetch('/api/funding')
            .then(r => r.ok ? r.json() : null)
            .then(json => {
              if (aborted) return;
              const data: any[] = json?.data || json || [];
              const found = new Set<string>();
              for (const f of data) {
                if (f.symbol === symbol && fundingExchanges.includes(f.exchange) && f.markPrice > 0) {
                  handlePrice({
                    exchange: f.exchange, symbol, price: f.markPrice,
                    bid: f.markPrice, ask: f.markPrice, ts: now,
                  });
                  found.add(f.exchange);
                }
              }
              setConnected(prev => {
                const next = { ...prev };
                for (const e of fundingExchanges) next[e] = found.has(e);
                return next;
              });
            })
            .catch(() => {})
        );
      }

      Promise.allSettled(promises);
    };

    // First poll immediately, then every 2s
    poll();
    const pollTimer = setInterval(poll, POLL_INTERVAL);

    // Snapshot prices for chart history (only non-stale prices)
    historyRef.current = [];
    setHistory([]);
    const historyTimer = setInterval(() => {
      const now = Date.now();
      const current = pricesRef.current;
      const priceMap: Record<string, number> = {};
      let hasAny = false;
      for (const [ex, p] of Object.entries(current)) {
        // Exclude stale prices (>20s old) to avoid false spreads
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
      clearInterval(pollTimer);
      clearInterval(historyTimer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, exchangeKey, enabled, handlePrice]);

  return { prices, connected, history };
}
