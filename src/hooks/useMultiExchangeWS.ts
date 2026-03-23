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

// Binance Futures: wss://fstream.binance.com/ws/{symbol}usdt@bookTicker
// Bybit: wss://stream.bybit.com/v5/public/linear (subscribe to tickers.{SYMBOL}USDT)
// OKX: wss://ws.okx.com:8443/ws/v5/public (subscribe to tickers, instId={SYMBOL}-USDT-SWAP)
// Hyperliquid: wss://api.hyperliquid.xyz/ws (subscribe to allMids)

function createBinanceWS(symbol: string, onPrice: (p: WSPrice) => void): WebSocket | null {
  try {
    const pair = `${symbol.toLowerCase()}usdt`;
    const ws = new WebSocket(`wss://fstream.binance.com/ws/${pair}@bookTicker`);
    ws.onmessage = (e) => {
      try {
        const d = JSON.parse(e.data);
        if (d.s && d.b && d.a) {
          const bid = +d.b, ask = +d.a;
          onPrice({ exchange: 'Binance', symbol, price: (bid + ask) / 2, bid, ask, ts: d.T || Date.now() });
        }
      } catch {}
    };
    return ws;
  } catch { return null; }
}

function createBybitWS(symbol: string, onPrice: (p: WSPrice) => void): WebSocket | null {
  try {
    const ws = new WebSocket('wss://stream.bybit.com/v5/public/linear');
    ws.onopen = () => {
      ws.send(JSON.stringify({ op: 'subscribe', args: [`tickers.${symbol}USDT`] }));
    };
    ws.onmessage = (e) => {
      try {
        const d = JSON.parse(e.data);
        if (d.topic?.startsWith('tickers.') && d.data) {
          const t = d.data;
          const bid = +(t.bid1Price || 0), ask = +(t.ask1Price || 0);
          const last = +(t.lastPrice || 0);
          if (last > 0) {
            onPrice({ exchange: 'Bybit', symbol, price: last, bid: bid || last, ask: ask || last, ts: d.ts || Date.now() });
          }
        }
      } catch {}
    };
    // Bybit requires ping every 20s
    const ping = setInterval(() => { try { ws.send(JSON.stringify({ op: 'ping' })); } catch {} }, 20000);
    ws.onclose = () => clearInterval(ping);
    return ws;
  } catch { return null; }
}

function createOKXWS(symbol: string, onPrice: (p: WSPrice) => void): WebSocket | null {
  try {
    const ws = new WebSocket('wss://ws.okx.com:8443/ws/v5/public');
    ws.onopen = () => {
      ws.send(JSON.stringify({ op: 'subscribe', args: [{ channel: 'tickers', instId: `${symbol}-USDT-SWAP` }] }));
    };
    ws.onmessage = (e) => {
      try {
        const d = JSON.parse(e.data);
        if (d.data?.[0]) {
          const t = d.data[0];
          const bid = +(t.bidPx || 0), ask = +(t.askPx || 0), last = +(t.last || 0);
          if (last > 0) {
            onPrice({ exchange: 'OKX', symbol, price: last, bid: bid || last, ask: ask || last, ts: +t.ts || Date.now() });
          }
        }
      } catch {}
    };
    return ws;
  } catch { return null; }
}

function createHyperliquidWS(symbol: string, onPrice: (p: WSPrice) => void): WebSocket | null {
  try {
    const ws = new WebSocket('wss://api.hyperliquid.xyz/ws');
    ws.onopen = () => {
      ws.send(JSON.stringify({ method: 'subscribe', subscription: { type: 'allMids' } }));
    };
    ws.onmessage = (e) => {
      try {
        const d = JSON.parse(e.data);
        if (d.channel === 'allMids' && d.data?.mids) {
          const mid = d.data.mids[symbol];
          if (mid) {
            const price = +mid;
            if (price > 0) {
              onPrice({ exchange: 'Hyperliquid', symbol, price, bid: price, ask: price, ts: Date.now() });
            }
          }
        }
      } catch {}
    };
    return ws;
  } catch { return null; }
}

function createBitgetWS(symbol: string, onPrice: (p: WSPrice) => void): WebSocket | null {
  try {
    const ws = new WebSocket('wss://ws.bitget.com/v2/ws/public');
    ws.onopen = () => {
      ws.send(JSON.stringify({ op: 'subscribe', args: [{ instType: 'USDT-FUTURES', channel: 'ticker', instId: `${symbol}USDT` }] }));
    };
    ws.onmessage = (e) => {
      try {
        const d = JSON.parse(e.data);
        if (d.data?.[0]) {
          const t = d.data[0];
          const last = +(t.lastPr || t.last || 0);
          const bid = +(t.bidPr || t.bid1 || last);
          const ask = +(t.askPr || t.ask1 || last);
          if (last > 0) onPrice({ exchange: 'Bitget', symbol, price: last, bid, ask, ts: +t.ts || Date.now() });
        }
      } catch {}
    };
    const ping = setInterval(() => { try { ws.send('ping'); } catch {} }, 25000);
    ws.onclose = () => clearInterval(ping);
    return ws;
  } catch { return null; }
}

function createMEXCWS(symbol: string, onPrice: (p: WSPrice) => void): WebSocket | null {
  try {
    const ws = new WebSocket('wss://contract.mexc.com/edge');
    ws.onopen = () => {
      ws.send(JSON.stringify({ method: 'sub.ticker', param: { symbol: `${symbol}_USDT` } }));
    };
    ws.onmessage = (e) => {
      try {
        const d = JSON.parse(e.data);
        if (d.channel === 'push.ticker' && d.data) {
          const t = d.data;
          const last = +(t.lastPrice || t.fairPrice || 0);
          const bid = +(t.bid1 || last);
          const ask = +(t.ask1 || last);
          if (last > 0) onPrice({ exchange: 'MEXC', symbol, price: last, bid, ask, ts: d.ts || Date.now() });
        }
      } catch {}
    };
    const ping = setInterval(() => { try { ws.send(JSON.stringify({ method: 'ping' })); } catch {} }, 20000);
    ws.onclose = () => clearInterval(ping);
    return ws;
  } catch { return null; }
}

const WS_CREATORS: Record<string, (s: string, cb: (p: WSPrice) => void) => WebSocket | null> = {
  Binance: createBinanceWS,
  Bybit: createBybitWS,
  OKX: createOKXWS,
  Bitget: createBitgetWS,
  MEXC: createMEXCWS,
  Hyperliquid: createHyperliquidWS,
};

export const WS_SUPPORTED = Object.keys(WS_CREATORS);

export type PriceSnapshot = { t: number; prices: Record<string, number> };

const MAX_HISTORY = 2000; // ~2.7 hours at 5s intervals

export function useMultiExchangeWS(symbol: string, exchanges: string[], enabled = true) {
  const [prices, setPrices] = useState<PriceMap>({});
  const [connected, setConnected] = useState<Record<string, boolean>>({});
  const [history, setHistory] = useState<PriceSnapshot[]>([]);
  const wsRefs = useRef<Record<string, WebSocket>>({});
  const pricesRef = useRef<PriceMap>({});
  const historyRef = useRef<PriceSnapshot[]>([]);
  const updateTimer = useRef<NodeJS.Timeout | null>(null);
  const historyTimer = useRef<NodeJS.Timeout | null>(null);

  // Batch state updates every 250ms to avoid excessive re-renders
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

    const wsExchanges = exchanges.filter(e => WS_CREATORS[e]);
    const conState: Record<string, boolean> = {};

    for (const ex of wsExchanges) {
      const ws = WS_CREATORS[ex](symbol, handlePrice);
      if (ws) {
        wsRefs.current[ex] = ws;
        // Use addEventListener to avoid overwriting onopen/onclose set by create functions
        ws.addEventListener('open', () => {
          conState[ex] = true;
          setConnected(prev => ({ ...prev, [ex]: true }));
        });
        ws.addEventListener('close', () => {
          conState[ex] = false;
          setConnected(prev => ({ ...prev, [ex]: false }));
        });
        ws.addEventListener('error', () => {
          conState[ex] = false;
          setConnected(prev => ({ ...prev, [ex]: false }));
        });
      }
    }

    // REST polling fallback for exchanges without WebSocket support
    const restExchanges = exchanges.filter(e => !WS_CREATORS[e]);
    let restTimer: NodeJS.Timeout | null = null;
    if (restExchanges.length > 0) {
      const pollRest = () => {
        fetch('/api/tickers')
          .then(r => r.ok ? r.json() : null)
          .then(json => {
            const tickers: any[] = json?.data || json || [];
            for (const t of tickers) {
              if (t.symbol === symbol && restExchanges.includes(t.exchange) && t.lastPrice > 0) {
                handlePrice({
                  exchange: t.exchange, symbol, price: t.lastPrice,
                  bid: t.lastPrice, ask: t.lastPrice, ts: Date.now(),
                });
              }
            }
          })
          .catch(() => {});
      };
      pollRest(); // immediate first fetch
      restTimer = setInterval(pollRest, 10_000); // poll every 10s
    }

    // Snapshot prices every 5 seconds for chart history
    historyRef.current = [];
    setHistory([]);
    historyTimer.current = setInterval(() => {
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
      Object.values(wsRefs.current).forEach(ws => {
        try { ws.close(); } catch {}
      });
      wsRefs.current = {};
      pricesRef.current = {};
      if (updateTimer.current) clearTimeout(updateTimer.current);
      updateTimer.current = null;
      if (historyTimer.current) clearInterval(historyTimer.current);
      historyTimer.current = null;
      if (restTimer) clearInterval(restTimer);
    };
  }, [symbol, exchanges.join(','), enabled, handlePrice]);

  return { prices, connected, history };
}
