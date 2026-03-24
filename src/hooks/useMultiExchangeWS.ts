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

// All exchanges are supported via REST polling — no WS needed
export const WS_SUPPORTED: string[] = [];

export type PriceSnapshot = { t: number; prices: Record<string, number> };

const MAX_HISTORY = 2000; // ~2.7 hours at 5s intervals
const POLL_INTERVAL = 5_000; // 5 seconds

// Exchanges whose prices come from /api/funding (markPrice) instead of /api/tickers
const FUNDING_EXCHANGES = new Set(['gTrade', 'GMX']);

export function useMultiExchangeWS(symbol: string, exchanges: string[], enabled = true) {
  const [prices, setPrices] = useState<PriceMap>({});
  const [connected, setConnected] = useState<Record<string, boolean>>({});
  const [history, setHistory] = useState<PriceSnapshot[]>([]);
  const pricesRef = useRef<PriceMap>({});
  const historyRef = useRef<PriceSnapshot[]>([]);
  const updateTimer = useRef<NodeJS.Timeout | null>(null);

  const scheduleBatchUpdate = useCallback(() => {
    if (updateTimer.current) return;
    updateTimer.current = setTimeout(() => {
      setPrices({ ...pricesRef.current });
      updateTimer.current = null;
    }, 250);
  }, []);

  const handlePrice = useCallback((p: WSPrice) => {
    pricesRef.current[p.exchange] = p;
    scheduleBatchUpdate();
  }, [scheduleBatchUpdate]);

  useEffect(() => {
    if (!enabled || !symbol) return;

    const tickerExchanges = exchanges.filter(e => !FUNDING_EXCHANGES.has(e));
    const fundingExchanges = exchanges.filter(e => FUNDING_EXCHANGES.has(e));

    const poll = () => {
      // Fetch tickers for most exchanges
      if (tickerExchanges.length > 0) {
        fetch('/api/tickers')
          .then(r => r.ok ? r.json() : null)
          .then(json => {
            const tickers: any[] = json?.data || json || [];
            const found = new Set<string>();
            for (const t of tickers) {
              if (t.symbol === symbol && exchanges.includes(t.exchange) && t.lastPrice > 0) {
                handlePrice({
                  exchange: t.exchange, symbol, price: t.lastPrice,
                  bid: t.lastPrice, ask: t.lastPrice, ts: Date.now(),
                });
                found.add(t.exchange);
              }
            }
            // Update connected state
            setConnected(prev => {
              const next = { ...prev };
              for (const e of tickerExchanges) next[e] = found.has(e);
              return next;
            });
          })
          .catch(() => {});
      }

      // Fetch gTrade/GMX prices from funding API (markPrice)
      if (fundingExchanges.length > 0) {
        fetch('/api/funding')
          .then(r => r.ok ? r.json() : null)
          .then(json => {
            const data: any[] = json?.data || json || [];
            const found = new Set<string>();
            for (const f of data) {
              if (f.symbol === symbol && fundingExchanges.includes(f.exchange) && f.markPrice > 0) {
                handlePrice({
                  exchange: f.exchange, symbol, price: f.markPrice,
                  bid: f.markPrice, ask: f.markPrice, ts: Date.now(),
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
          .catch(() => {});
      }
    };

    // First poll immediately, then every 5s
    poll();
    const pollTimer = setInterval(poll, POLL_INTERVAL);

    // Snapshot prices every 5 seconds for chart history
    historyRef.current = [];
    setHistory([]);
    const historyTimer = setInterval(() => {
      const current = pricesRef.current;
      const priceMap: Record<string, number> = {};
      let hasAny = false;
      for (const [ex, p] of Object.entries(current)) {
        if (p.price > 0) { priceMap[ex] = p.price; hasAny = true; }
      }
      if (hasAny) {
        const snap: PriceSnapshot = { t: Date.now(), prices: priceMap };
        historyRef.current.push(snap);
        if (historyRef.current.length > MAX_HISTORY) historyRef.current.shift();
        setHistory([...historyRef.current]);
      }
    }, 5000);

    return () => {
      pricesRef.current = {};
      if (updateTimer.current) clearTimeout(updateTimer.current);
      updateTimer.current = null;
      clearInterval(pollTimer);
      clearInterval(historyTimer);
    };
  }, [symbol, exchanges.join(','), enabled, handlePrice]);

  return { prices, connected, history };
}
