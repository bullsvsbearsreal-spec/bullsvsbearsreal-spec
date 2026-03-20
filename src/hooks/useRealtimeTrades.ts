'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Real-time trade stream via Binance Futures WebSocket.
 * Provides live aggTrades with buy/sell classification and rolling CVD.
 */

export interface RealtimeTrade {
  time: number;
  price: number;
  qty: number;
  quoteQty: number;
  isBuy: boolean;
}

export interface TradeStats {
  buyVolume: number;
  sellVolume: number;
  netDelta: number;
  tradeCount: number;
  tradeSpeed: number; // per minute
  bigBuys: number;    // >$50K
  bigSells: number;
}

interface BinanceAggTrade {
  e: string;   // event type
  E: number;   // event time
  s: string;   // symbol
  p: string;   // price
  q: string;   // quantity
  m: boolean;  // is market maker (true = seller initiated = SELL)
  T: number;   // trade time
}

const MAX_TRADES = 200;
const BIG_TRADE_USD = 50_000;
const STATS_WINDOW_MS = 5 * 60_000; // 5 minutes for rolling stats

export function useRealtimeTrades(symbol: string) {
  const [trades, setTrades] = useState<RealtimeTrade[]>([]);
  const [stats, setStats] = useState<TradeStats>({
    buyVolume: 0, sellVolume: 0, netDelta: 0, tradeCount: 0, tradeSpeed: 0, bigBuys: 0, bigSells: 0,
  });
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const tradesRef = useRef<RealtimeTrade[]>([]);
  const statsTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const computeStats = useCallback(() => {
    const now = Date.now();
    const window = tradesRef.current.filter(t => now - t.time < STATS_WINDOW_MS);
    let buyVol = 0, sellVol = 0, bigBuys = 0, bigSells = 0;
    for (const t of window) {
      if (t.isBuy) {
        buyVol += t.quoteQty;
        if (t.quoteQty >= BIG_TRADE_USD) bigBuys++;
      } else {
        sellVol += t.quoteQty;
        if (t.quoteQty >= BIG_TRADE_USD) bigSells++;
      }
    }
    const spanMin = Math.max((now - (window[window.length - 1]?.time || now)) / 60_000, 1);
    setStats({
      buyVolume: buyVol,
      sellVolume: sellVol,
      netDelta: buyVol - sellVol,
      tradeCount: window.length,
      tradeSpeed: Math.round(window.length / spanMin),
      bigBuys,
      bigSells,
    });
  }, []);

  useEffect(() => {
    if (!symbol) return; // Skip when not in live mode

    const pair = symbol.toUpperCase() + 'USDT';
    const url = `wss://fstream.binance.com/ws/${pair.toLowerCase()}@aggTrade`;

    // Reset state on symbol change
    tradesRef.current = [];
    setTrades([]);
    setStats({ buyVolume: 0, sellVolume: 0, netDelta: 0, tradeCount: 0, tradeSpeed: 0, bigBuys: 0, bigSells: 0 });

    const connect = () => {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => setConnected(true);

      ws.onmessage = (event) => {
        try {
          const msg: BinanceAggTrade = JSON.parse(event.data);
          if (msg.e !== 'aggTrade') return;

          const price = parseFloat(msg.p);
          const qty = parseFloat(msg.q);
          const quoteQty = price * qty;
          const trade: RealtimeTrade = {
            time: msg.T,
            price,
            qty,
            quoteQty,
            isBuy: !msg.m, // m=true means seller initiated
          };

          tradesRef.current = [trade, ...tradesRef.current].slice(0, MAX_TRADES);
          setTrades(prev => [trade, ...prev].slice(0, MAX_TRADES));
        } catch { /* skip malformed */ }
      };

      ws.onclose = () => {
        setConnected(false);
        // Reconnect after 3s
        setTimeout(connect, 3000);
      };

      ws.onerror = () => ws.close();
    };

    connect();

    // Compute rolling stats every 2s
    statsTimerRef.current = setInterval(computeStats, 2000);

    return () => {
      if (wsRef.current) {
        wsRef.current.onclose = null; // prevent reconnect
        wsRef.current.close();
      }
      if (statsTimerRef.current) clearInterval(statsTimerRef.current);
    };
  }, [symbol, computeStats]);

  return { trades, stats, connected };
}
