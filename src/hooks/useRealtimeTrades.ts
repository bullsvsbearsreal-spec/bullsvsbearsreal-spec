'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  computeTradeStats,
  type RealtimeTrade,
  type TradeStats,
} from './computeTradeStats';

/**
 * Real-time trade stream via Binance Futures WebSocket.
 * Provides live aggTrades with buy/sell classification and rolling CVD.
 * Pure stats math lives in `./computeTradeStats.ts`.
 */

export type { RealtimeTrade, TradeStats };

/** Time windows for stats aggregation */
export type StatsWindow = 'live' | '5m' | '15m' | '1h' | 'all';

export const STATS_WINDOWS: { key: StatsWindow; label: string; ms: number }[] = [
  { key: 'live', label: 'Live', ms: 60_000 },      // ~1 min rolling
  { key: '5m',   label: '5m',   ms: 5 * 60_000 },
  { key: '15m',  label: '15m',  ms: 15 * 60_000 },
  { key: '1h',   label: '1h',   ms: 60 * 60_000 },
  { key: 'all',  label: 'All',  ms: Infinity },
];

interface BinanceAggTrade {
  e: string;   // event type
  E: number;   // event time
  s: string;   // symbol
  p: string;   // price
  q: string;   // quantity
  m: boolean;  // is market maker (true = seller initiated = SELL)
  T: number;   // trade time
}

const MAX_DISPLAY_TRADES = 200;
const MAX_STATS_TRADES = 10_000; // Keep more for longer windows

export function useRealtimeTrades(symbol: string) {
  const [trades, setTrades] = useState<RealtimeTrade[]>([]);
  const [stats, setStats] = useState<TradeStats>({
    buyVolume: 0, sellVolume: 0, netDelta: 0, tradeCount: 0, tradeSpeed: 0, bigBuys: 0, bigSells: 0, cvd: 0, vwap: 0, cvdHistory: [],
  });
  const [connected, setConnected] = useState(false);
  const [statsWindow, setStatsWindow] = useState<StatsWindow>('5m');
  const wsRef = useRef<WebSocket | null>(null);
  const destroyedRef = useRef(false);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const allTradesRef = useRef<RealtimeTrade[]>([]);
  const statsWindowRef = useRef<StatsWindow>('5m');
  const statsTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep ref in sync for the timer callback
  useEffect(() => { statsWindowRef.current = statsWindow; }, [statsWindow]);

  const computeStats = useCallback(() => {
    const now = Date.now();
    const windowDef = STATS_WINDOWS.find(w => w.key === statsWindowRef.current) ?? STATS_WINDOWS[1];
    setStats(computeTradeStats(allTradesRef.current, windowDef.ms, now));
  }, []);

  useEffect(() => {
    // Always clean up previous timers/connections regardless of symbol
    destroyedRef.current = true;
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close(); }
    if (statsTimerRef.current) clearInterval(statsTimerRef.current);

    if (!symbol) return; // Skip when not in live mode

    const pair = symbol.toUpperCase() + 'USDT';
    const url = `wss://fstream.binance.com/ws/${pair.toLowerCase()}@aggTrade`;

    // Reset state on symbol change
    allTradesRef.current = [];
    setTrades([]);
    setStats({ buyVolume: 0, sellVolume: 0, netDelta: 0, tradeCount: 0, tradeSpeed: 0, bigBuys: 0, bigSells: 0, cvd: 0, vwap: 0, cvdHistory: [] });

    destroyedRef.current = false;

    const connect = () => {
      let ws: WebSocket;
      try {
        ws = new WebSocket(url);
      } catch {
        setConnected(false);
        if (!destroyedRef.current) {
          reconnectTimerRef.current = setTimeout(connect, 3000);
        }
        return;
      }
      wsRef.current = ws;

      ws.onopen = () => setConnected(true);

      ws.onmessage = (event) => {
        try {
          const msg: BinanceAggTrade = JSON.parse(event.data);
          if (msg.e !== 'aggTrade') return;

          const price = parseFloat(msg.p);
          const qty = parseFloat(msg.q);
          // Reject malformed quote-pairs early — without this guard a
          // single NaN-bearing trade poisons the session's CVD / VWAP /
          // buyVol forever (NaN propagates through sums). Verified
          // against computeTradeStats which doesn't filter at the
          // aggregation layer.
          if (!Number.isFinite(price) || !Number.isFinite(qty) || price <= 0 || qty <= 0) return;
          const quoteQty = price * qty;
          const trade: RealtimeTrade = {
            time: msg.T,
            price,
            qty,
            quoteQty,
            isBuy: !msg.m, // m=true means seller initiated
          };

          allTradesRef.current = [trade, ...allTradesRef.current].slice(0, MAX_STATS_TRADES);
          setTrades(prev => [trade, ...prev].slice(0, MAX_DISPLAY_TRADES));
        } catch { /* skip malformed */ }
      };

      ws.onclose = () => {
        setConnected(false);
        // Reconnect after 3s unless destroyed
        if (!destroyedRef.current) {
          reconnectTimerRef.current = setTimeout(connect, 3000);
        }
      };

      ws.onerror = () => ws.close();
    };

    connect();

    // Compute rolling stats every 2s
    statsTimerRef.current = setInterval(computeStats, 2000);

    return () => {
      destroyedRef.current = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null; // prevent reconnect
        wsRef.current.close();
      }
      if (statsTimerRef.current) clearInterval(statsTimerRef.current);
    };
  }, [symbol, computeStats]);

  return { trades, stats, connected, statsWindow, setStatsWindow };
}
