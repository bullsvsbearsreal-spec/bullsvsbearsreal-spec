'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Real-time liquidation stream for the chart page.
 * - Binance WebSocket (real-time, all symbols)
 * - REST API poll from DB every 15s (backfills recent history)
 * In-memory only — clears on refresh.
 */

export interface RealtimeLiq {
  time: number;
  symbol: string;
  side: 'long' | 'short';
  value: number;
  price: number;
  exchange: string;
}

export interface LiqStats {
  count: number;
  totalValue: number;
  longCount: number;
  shortCount: number;
  longValue: number;
  shortValue: number;
}

export type LiqWindow = 'live' | '5m' | '15m' | '1h' | 'all';

export const LIQ_WINDOWS: { key: LiqWindow; label: string; ms: number }[] = [
  { key: 'live', label: 'Live', ms: 60_000 },
  { key: '5m',   label: '5m',   ms: 5 * 60_000 },
  { key: '15m',  label: '15m',  ms: 15 * 60_000 },
  { key: '1h',   label: '1h',   ms: 60 * 60_000 },
  { key: 'all',  label: 'All',  ms: Infinity },
];

const MAX_LIQS = 500;
const MIN_VALUE = 100;
const RECONNECT_DELAY = 3000;
const POLL_INTERVAL = 15_000;

import { normalizeSymbolBase as normalizeSymbol } from '@/lib/utils/normalize';

export function useRealtimeLiquidations(enabled: boolean) {
  const [liqs, setLiqs] = useState<RealtimeLiq[]>([]);
  const [stats, setStats] = useState<LiqStats>({ count: 0, totalValue: 0, longCount: 0, shortCount: 0, longValue: 0, shortValue: 0 });
  const [connected, setConnected] = useState(false);
  const [liqWindow, setLiqWindow] = useState<LiqWindow>('5m');

  const allLiqsRef = useRef<RealtimeLiq[]>([]);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const windowRef = useRef<LiqWindow>('5m');
  const statsTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { windowRef.current = liqWindow; }, [liqWindow]);

  const addLiq = useCallback((liq: RealtimeLiq) => {
    const key = `${liq.exchange}-${liq.time}-${liq.value.toFixed(2)}-${liq.side}`;
    if (seenIdsRef.current.has(key)) return;
    seenIdsRef.current.add(key);
    if (seenIdsRef.current.size > 2000) {
      const arr = Array.from(seenIdsRef.current);
      seenIdsRef.current = new Set(arr.slice(-1000));
    }
    allLiqsRef.current = [liq, ...allLiqsRef.current].slice(0, MAX_LIQS);
    setLiqs(prev => [liq, ...prev].slice(0, MAX_LIQS));
  }, []);

  const addMany = useCallback((newLiqs: RealtimeLiq[]) => {
    const unique: RealtimeLiq[] = [];
    for (const liq of newLiqs) {
      const key = `${liq.exchange}-${liq.time}-${liq.value.toFixed(2)}-${liq.side}`;
      if (seenIdsRef.current.has(key)) continue;
      seenIdsRef.current.add(key);
      unique.push(liq);
    }
    if (unique.length === 0) return;
    if (seenIdsRef.current.size > 2000) {
      const arr = Array.from(seenIdsRef.current);
      seenIdsRef.current = new Set(arr.slice(-1000));
    }
    allLiqsRef.current = [...unique, ...allLiqsRef.current]
      .sort((a, b) => b.time - a.time)
      .slice(0, MAX_LIQS);
    setLiqs(allLiqsRef.current);
  }, []);

  const computeStats = useCallback(() => {
    const now = Date.now();
    const windowDef = LIQ_WINDOWS.find(w => w.key === windowRef.current) ?? LIQ_WINDOWS[1];
    const ms = windowDef.ms;
    const filtered = ms === Infinity
      ? allLiqsRef.current
      : allLiqsRef.current.filter(l => now - l.time < ms);

    let totalValue = 0, longCount = 0, shortCount = 0, longValue = 0, shortValue = 0;
    for (const l of filtered) {
      totalValue += l.value;
      if (l.side === 'long') { longCount++; longValue += l.value; }
      else { shortCount++; shortValue += l.value; }
    }
    setStats({ count: filtered.length, totalValue, longCount, shortCount, longValue, shortValue });
  }, []);

  const getFilteredLiqs = useCallback(() => {
    const now = Date.now();
    const windowDef = LIQ_WINDOWS.find(w => w.key === liqWindow) ?? LIQ_WINDOWS[1];
    const ms = windowDef.ms;
    return ms === Infinity ? liqs : liqs.filter(l => now - l.time < ms);
  }, [liqs, liqWindow]);

  useEffect(() => {
    if (!enabled) return;

    allLiqsRef.current = [];
    seenIdsRef.current = new Set();
    setLiqs([]);
    setStats({ count: 0, totalValue: 0, longCount: 0, shortCount: 0, longValue: 0, shortValue: 0 });

    let destroyed = false;

    // ── REST API poll: seed + backfill from DB ──
    const pollHistory = async () => {
      if (destroyed) return;
      try {
        const res = await fetch('/api/history/liquidations?mode=feed&hours=1&limit=50&exchange=Binance');
        if (!res.ok) return;
        const json = await res.json();
        const items: RealtimeLiq[] = (json.data || []).map((d: any) => ({
          time: d.ts,
          symbol: d.symbol,
          side: d.side as 'long' | 'short',
          value: d.valueUsd,
          price: d.price,
          exchange: d.exchange,
        })).filter((l: RealtimeLiq) => l.value >= MIN_VALUE);
        addMany(items);
      } catch { /* skip */ }
    };

    pollHistory();
    const pollTimer = setInterval(pollHistory, POLL_INTERVAL);

    // ── Binance WebSocket: real-time ──
    let binWs: WebSocket | null = null;
    let binReconnect: ReturnType<typeof setTimeout> | null = null;

    const connectBinance = () => {
      if (destroyed) return;
      binWs = new WebSocket('wss://fstream.binance.com/ws/!forceOrder@arr');
      binWs.onopen = () => setConnected(true);
      binWs.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.e !== 'forceOrder') return;
          const o = data.o;
          const price = parseFloat(o.p);
          const qty = parseFloat(o.q);
          // NaN guard: `value < MIN_VALUE` is `false` for NaN, so a
          // single malformed message would otherwise leak NaN price/value
          // into the liquidations feed and corrupt downstream sorts/sums.
          if (!Number.isFinite(price) || !Number.isFinite(qty) || price <= 0 || qty <= 0) return;
          const value = price * qty;
          if (value < MIN_VALUE) return;
          addLiq({
            time: o.T || Date.now(),
            symbol: normalizeSymbol(o.s || ''),
            side: o.S === 'BUY' ? 'short' : 'long',
            value,
            price,
            exchange: 'Binance',
          });
        } catch { /* skip */ }
      };
      binWs.onclose = () => {
        setConnected(false);
        if (!destroyed) binReconnect = setTimeout(connectBinance, RECONNECT_DELAY);
      };
      binWs.onerror = () => binWs?.close();
    };

    connectBinance();
    statsTimerRef.current = setInterval(computeStats, 2000);

    return () => {
      destroyed = true;
      clearInterval(pollTimer);
      if (binWs) { binWs.onclose = null; binWs.close(); }
      if (binReconnect) clearTimeout(binReconnect);
      if (statsTimerRef.current) clearInterval(statsTimerRef.current);
    };
  }, [enabled, addLiq, addMany, computeStats]);

  return { liqs, stats, connected, liqWindow, setLiqWindow, getFilteredLiqs };
}
