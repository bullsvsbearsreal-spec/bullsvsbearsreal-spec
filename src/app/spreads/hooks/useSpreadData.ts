'use client';

import { useEffect, useRef, useMemo, useCallback } from 'react';
import { useMultiExchangeWS } from '@/hooks/useMultiExchangeWS';
import { transformLiveData, transformKlineData, computeStats, filterOutliers } from '../lib/spread-math';
import { SYMBOLS } from '../lib/symbols';
import { TFS } from '../lib/types';
import type { TfKey, Candle, Pt, SpreadStats, SpreadInfo, TickerEntry, FundingEntry, OIEntry } from '../lib/types';

interface UseSpreadDataOptions {
  sym: string;
  sel: string[];
  tf: TfKey;
  wsEnabled: boolean;
  klineData: Record<string, Candle[]> | null;
  onSetKlineData: (data: Record<string, Candle[]> | null) => void;
  onMergeKlineData: (data: Record<string, Candle[]>) => void;
  onSetChartLoading: (loading: boolean) => void;
  onSetDynamicSymbols: (syms: string[]) => void;
}

export function useSpreadData({
  sym, sel, tf, wsEnabled,
  klineData, onSetKlineData, onMergeKlineData, onSetChartLoading, onSetDynamicSymbols,
}: UseSpreadDataOptions) {
  // ── WebSocket real-time prices ──
  const { prices: wsPrices, connected: wsConnected, history: wsHistory, status: wsStatus } = useMultiExchangeWS(sym, sel, wsEnabled);
  const wsCount = Object.values(wsConnected).filter(Boolean).length;

  // ── Compute live spread from WS prices ──
  const wsSpread = useMemo<SpreadInfo | null>(() => {
    const wsPriceValues = Object.values(wsPrices).filter(p => p.price > 0);
    if (wsPriceValues.length < 2) return null;
    const entries = wsPriceValues.map(p => ({ e: p.exchange, p: p.price }));
    const sane = filterOutliers(entries);
    if (sane.length < 2) return null;
    const sorted = [...sane].sort((a, b) => b.p - a.p);
    const spread = sorted[0].p - sorted[sorted.length - 1].p;
    const pct = (spread / sorted[sorted.length - 1].p) * 100;
    return {
      spread, pct,
      high: { exchange: sorted[0].e, price: sorted[0].p },
      low: { exchange: sorted[sorted.length - 1].e, price: sorted[sorted.length - 1].p },
      prices: sorted.map(s => ({ exchange: s.e, price: s.p })),
    };
  }, [wsPrices]);

  // ── Chart data transform ──
  const { data, exs, available } = useMemo(() => {
    if (tf === 'live') {
      return { ...transformLiveData(wsHistory, sel), available: undefined };
    }
    if (!klineData) return { data: [] as Pt[], exs: [] as string[], available: undefined };
    return transformKlineData(klineData, sel, tf, wsPrices);
  }, [klineData, sel, tf, wsHistory, wsPrices]);

  // ── Stats ──
  const stats = useMemo<SpreadStats | null>(() => computeStats(data, exs), [data, exs]);

  // ── Fetch klines for DB timeframes ──
  const selRef = useRef(sel);
  selRef.current = sel;

  useEffect(() => {
    const t = TFS.find(x => x.key === tf);
    if (!t || t.source !== 'db') { onSetChartLoading(false); return; }
    onSetChartLoading(true);
    let cancelled = false;
    const days = (t as any).days || 7;
    const interval = (t as any).interval || '1h';
    const limit = (t as any).limit || 168;

    // All exchanges from VPS aggregator in one request
    fetch(`/api/klines-multi?symbol=${sym}&interval=${interval}&limit=${limit}`)
      .then(r => r.ok ? r.json() : null)
      .then(json => {
        if (cancelled) return;
        const klines = json?.exchanges || {};
        if (Object.keys(klines).length > 0) {
          onSetKlineData(klines);
          onSetChartLoading(false);
        }
      }).catch(() => {});

    // DB sources in background — merge (don't replace) to supplement VPS data
    Promise.allSettled([
      fetch(`/api/history/price-multi?symbol=${sym}&days=${days}`, { signal: AbortSignal.timeout(5000) }).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`/api/history/spreads?symbol=${sym}&days=${days}`, { signal: AbortSignal.timeout(5000) }).then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([dbPriceRes]) => {
      if (cancelled) return;
      const dbPrices = (dbPriceRes.status === 'fulfilled' && dbPriceRes.value?.exchanges) || {};
      if (Object.keys(dbPrices).length > 0) {
        onMergeKlineData(
          Object.fromEntries(
            Object.entries(dbPrices)
              .filter(([ex, pts]: [string, any]) => pts.length > 0)
              .map(([ex, pts]: [string, any]) => [
                ex,
                pts.map((p: any) => ({ t: p.t, o: p.price, h: p.price, l: p.price, c: p.price })).filter((x: Candle) => x.c > 0),
              ])
          )
        );
      }
    }).finally(() => { if (!cancelled) onSetChartLoading(false); });

    return () => { cancelled = true; };
  }, [sym, tf, onSetKlineData, onMergeKlineData, onSetChartLoading]);

  // ── Auto-refresh DB charts every 60s ──
  useEffect(() => {
    const tfDef = TFS.find(x => x.key === tf);
    if (!tfDef || tfDef.source !== 'db') return;
    const timer = setInterval(() => {
      const iv = (tfDef as any).interval || '1h';
      const lim = (tfDef as any).limit || 168;
      const days = (tfDef as any).days || 7;
      fetch(`/api/klines-multi?symbol=${sym}&interval=${iv}&limit=${lim}`)
        .then(r => r.ok ? r.json() : null)
        .then(json => {
          const klines = json?.exchanges || {};
          if (Object.keys(klines).length > 0) onMergeKlineData(klines);
        }).catch(() => {});
    }, 60_000);
    return () => clearInterval(timer);
  }, [sym, tf, onMergeKlineData]);

  // ── Fetch klines for newly added exchanges ──
  const kdRef = useRef(klineData);
  kdRef.current = klineData;
  const selKey = sel.join(',');
  useEffect(() => {
    if (!kdRef.current || tf === 'live') return;
    const cur = kdRef.current;
    const missing = sel.filter(e => !cur[e] || cur[e].length === 0);
    if (missing.length === 0) return;
    const t = TFS.find(x => x.key === tf);
    const interval = (t as any)?.interval || '1h';
    const limit = (t as any)?.limit || 168;
    let cancelled = false;
    // VPS returns all exchanges — re-fetch and merge any new ones
    fetch(`/api/klines-multi?symbol=${sym}&interval=${interval}&limit=${limit}`)
      .then(r => r.ok ? r.json() : null)
      .then(json => {
        if (cancelled) return;
        const extra = json?.exchanges || {};
        if (Object.keys(extra).length > 0) onMergeKlineData(extra);
      }).catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selKey, sym, tf]);

  // ── Discover dynamic symbols ──
  useEffect(() => {
    const t = setTimeout(() => {
      fetch('/api/tickers').then(r => r.ok ? r.json() : null).then(json => {
        const tickers: any[] = json?.data || json || [];
        const syms = new Set<string>();
        for (const t of tickers) if (t.symbol) syms.add(t.symbol);
        const existing = new Set(Object.values(SYMBOLS).flat());
        onSetDynamicSymbols(Array.from(syms).filter(s => !existing.has(s)).sort());
      }).catch(() => {});
    }, 5000);
    return () => clearTimeout(t);
  }, [onSetDynamicSymbols]);

  return {
    wsPrices,
    wsConnected,
    wsHistory,
    wsCount,
    wsSpread,
    wsStatus,
    data,
    exs,
    available,
    stats,
  };
}
