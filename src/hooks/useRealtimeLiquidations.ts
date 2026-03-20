'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Lightweight real-time liquidation stream for the chart page.
 * Connects to Binance + OKX WebSockets, shows ALL liquidations (global feed).
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
const MIN_VALUE = 100; // Skip tiny liquidations under $100
const RECONNECT_DELAY = 3000;

/** Normalize symbol: "BTCUSDT" → "BTC", "BTC-USDT-SWAP" → "BTC" */
function normalizeSymbol(raw: string): string {
  return raw
    .replace(/USD[_]?[A-Z]*$/i, '')
    .replace(/-.*$/, '')
    .replace(/1M/i, '')
    .toUpperCase();
}

export function useRealtimeLiquidations(enabled: boolean) {
  const [liqs, setLiqs] = useState<RealtimeLiq[]>([]);
  const [stats, setStats] = useState<LiqStats>({ count: 0, totalValue: 0, longCount: 0, shortCount: 0, longValue: 0, shortValue: 0 });
  const [connected, setConnected] = useState({ binance: false, okx: false });
  const [liqWindow, setLiqWindow] = useState<LiqWindow>('5m');

  const allLiqsRef = useRef<RealtimeLiq[]>([]);
  const windowRef = useRef<LiqWindow>('5m');
  const statsTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { windowRef.current = liqWindow; }, [liqWindow]);

  const addLiq = useCallback((liq: RealtimeLiq) => {
    allLiqsRef.current = [liq, ...allLiqsRef.current].slice(0, MAX_LIQS);
    setLiqs(prev => [liq, ...prev].slice(0, MAX_LIQS));
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

    setStats({
      count: filtered.length,
      totalValue,
      longCount,
      shortCount,
      longValue,
      shortValue,
    });
  }, []);

  // Get filtered liqs for display based on current window
  const getFilteredLiqs = useCallback(() => {
    const now = Date.now();
    const windowDef = LIQ_WINDOWS.find(w => w.key === liqWindow) ?? LIQ_WINDOWS[1];
    const ms = windowDef.ms;
    return ms === Infinity ? liqs : liqs.filter(l => now - l.time < ms);
  }, [liqs, liqWindow]);

  useEffect(() => {
    if (!enabled) return;

    // Reset
    allLiqsRef.current = [];
    setLiqs([]);
    setStats({ count: 0, totalValue: 0, longCount: 0, shortCount: 0, longValue: 0, shortValue: 0 });

    let destroyed = false;

    // ── Binance: wss://fstream.binance.com/ws/!forceOrder@arr ──
    // Streams ALL liquidations across all symbols
    let binWs: WebSocket | null = null;
    let binReconnect: ReturnType<typeof setTimeout> | null = null;

    const connectBinance = () => {
      if (destroyed) return;
      binWs = new WebSocket('wss://fstream.binance.com/ws/!forceOrder@arr');

      binWs.onopen = () => setConnected(c => ({ ...c, binance: true }));
      binWs.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.e !== 'forceOrder') return;
          const o = data.o;
          const price = parseFloat(o.p);
          const qty = parseFloat(o.q);
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
        setConnected(c => ({ ...c, binance: false }));
        if (!destroyed) binReconnect = setTimeout(connectBinance, RECONNECT_DELAY);
      };
      binWs.onerror = () => binWs?.close();
    };

    // ── OKX: wss://ws.okx.com:8443/ws/v5/public ──
    let okxWs: WebSocket | null = null;
    let okxReconnect: ReturnType<typeof setTimeout> | null = null;
    let okxPing: ReturnType<typeof setInterval> | null = null;

    const connectOKX = () => {
      if (destroyed) return;
      okxWs = new WebSocket('wss://ws.okx.com:8443/ws/v5/public');

      okxWs.onopen = () => {
        setConnected(c => ({ ...c, okx: true }));
        okxWs?.send(JSON.stringify({
          op: 'subscribe',
          args: [{ channel: 'liquidation-orders', instType: 'SWAP' }],
        }));
        okxPing = setInterval(() => {
          if (okxWs?.readyState === WebSocket.OPEN) okxWs.send('ping');
        }, 25000);
      };
      okxWs.onmessage = (event) => {
        try {
          if (event.data === 'pong') return;
          const data = JSON.parse(event.data);
          if (data.event) return; // subscription confirm
          if (data.data && Array.isArray(data.data)) {
            for (const item of data.data) {
              const px = parseFloat(item.bkPx || '0');
              const sz = parseFloat(item.sz || '0');
              const value = px * sz;
              if (value < MIN_VALUE) return;
              addLiq({
                time: parseInt(item.ts || '0') || Date.now(),
                symbol: normalizeSymbol(item.instId || ''),
                side: item.side === 'buy' ? 'short' : 'long',
                value,
                price: px,
                exchange: 'OKX',
              });
            }
          }
        } catch { /* skip */ }
      };
      okxWs.onclose = () => {
        setConnected(c => ({ ...c, okx: false }));
        if (okxPing) clearInterval(okxPing);
        if (!destroyed) okxReconnect = setTimeout(connectOKX, RECONNECT_DELAY);
      };
      okxWs.onerror = () => okxWs?.close();
    };

    connectBinance();
    connectOKX();

    // Compute stats every 2s
    statsTimerRef.current = setInterval(computeStats, 2000);

    return () => {
      destroyed = true;
      if (binWs) { binWs.onclose = null; binWs.close(); }
      if (okxWs) { okxWs.onclose = null; okxWs.close(); }
      if (binReconnect) clearTimeout(binReconnect);
      if (okxReconnect) clearTimeout(okxReconnect);
      if (okxPing) clearInterval(okxPing);
      if (statsTimerRef.current) clearInterval(statsTimerRef.current);
    };
  }, [enabled, addLiq, computeStats]);

  return { liqs, stats, connected, liqWindow, setLiqWindow, getFilteredLiqs };
}
