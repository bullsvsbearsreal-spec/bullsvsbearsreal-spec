'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { STALE_MS, HEARTBEAT_TIMEOUT_MS } from '@/app/spreads/lib/freshness';

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

export type ConnectionStatus = 'connecting' | 'connected' | 'degraded' | 'disconnected';

const MAX_HISTORY = 3000;
const AGGREGATOR_WS = 'wss://prices.info-hub.io';
const AGGREGATOR_HTTP = 'https://prices.info-hub.io';
const POLL_INTERVAL = 1_000;
const SNAPSHOT_INTERVAL = 1_500;
const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 15000]; // Exponential backoff

export function useMultiExchangeWS(symbol: string, exchanges: string[], enabled = true) {
  const [prices, setPrices] = useState<PriceMap>({});
  const [connected, setConnected] = useState<Record<string, boolean>>({});
  const [history, setHistory] = useState<PriceSnapshot[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');

  const exchangeKey = exchanges.join(',');
  const exchangesRef = useRef(exchanges);
  exchangesRef.current = exchanges;
  const pricesRef = useRef<PriceMap>({});
  const historyRef = useRef<PriceSnapshot[]>([]);
  const rafId = useRef<number>(0);
  const pendingUpdate = useRef(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempt = useRef(0);
  const lastHeartbeat = useRef(0);
  const usingPolling = useRef(false);
  const lastDataTs = useRef(0);

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
    lastDataTs.current = Date.now();
    scheduleBatchUpdate();
  }, [scheduleBatchUpdate]);

  // Update connection status based on exchange data (uses ref to stay stable)
  const updateConnectedState = useCallback((foundExchanges: Set<string>) => {
    const exs = exchangesRef.current;
    setConnected(prev => {
      let changed = false;
      for (const e of exs) {
        if (prev[e] !== foundExchanges.has(e)) { changed = true; break; }
      }
      if (!changed) return prev;
      const next: Record<string, boolean> = {};
      for (const e of exs) next[e] = foundExchanges.has(e);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!enabled || !symbol) return;
    let aborted = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let heartbeatChecker: ReturnType<typeof setInterval> | null = null;

    // ── Polling fallback ──
    const poll = () => {
      if (aborted) return;
      fetch(`${AGGREGATOR_HTTP}/prices?symbol=${symbol}`, { signal: AbortSignal.timeout(5000) })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (aborted || !data?.data?.[symbol]) return;
          const exPrices = data.data[symbol];
          const found = new Set<string>();
          for (const [ex, info] of Object.entries(exPrices) as [string, any][]) {
            if (!exchanges.includes(ex)) continue;
            if (info.price > 0) {
              handlePrice(ex, symbol, info.price, info.bid || info.price, info.ask || info.price, info.ts || Date.now());
              found.add(ex);
            }
          }
          updateConnectedState(found);
          if (found.size > 0) {
            setStatus(usingPolling.current ? 'degraded' : 'connected');
          }
        })
        .catch(() => {
          // After sustained failure, mark disconnected
          if (Date.now() - lastDataTs.current > STALE_MS) {
            setStatus('disconnected');
          }
        });
    };

    const startPolling = () => {
      if (pollTimer) return;
      usingPolling.current = true;
      poll();
      pollTimer = setInterval(poll, POLL_INTERVAL);
    };

    const stopPolling = () => {
      if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
      usingPolling.current = false;
    };

    // ── WebSocket connection ──
    const connectWS = () => {
      if (aborted) return;
      // Only show "connecting" if we have no data yet (avoid flashing during reconnect)
      if (!usingPolling.current && lastDataTs.current === 0) setStatus('connecting');

      try {
        const ws = new WebSocket(AGGREGATOR_WS);
        wsRef.current = ws;

        ws.onopen = () => {
          if (aborted) { ws.close(); return; }
          reconnectAttempt.current = 0;
          lastHeartbeat.current = Date.now();
          setStatus('connected');
          stopPolling();

          // Subscribe to the symbol
          ws.send(JSON.stringify({ subscribe: symbol }));
        };

        ws.onmessage = (event) => {
          if (aborted) return;
          try {
            const msg = JSON.parse(event.data as string);

            // Heartbeat
            if (msg.heartbeat) {
              lastHeartbeat.current = Date.now();
              return;
            }

            // Initial snapshot
            if (msg.snapshot) {
              const symData = msg.snapshot[symbol];
              if (symData) {
                const found = new Set<string>();
                for (const [ex, info] of Object.entries(symData) as [string, any][]) {
                  if (!exchanges.includes(ex)) continue;
                  if (info.price > 0) {
                    handlePrice(ex, symbol, info.price, info.bid || info.price, info.ask || info.price, info.ts || Date.now());
                    found.add(ex);
                  }
                }
                updateConnectedState(found);
              }
              return;
            }

            // Live price update: { s, e, p, b, a, t }
            if (msg.s && msg.e && msg.p) {
              if (msg.s !== symbol) return;
              if (!exchanges.includes(msg.e)) return;
              handlePrice(msg.e, msg.s, msg.p, msg.b || msg.p, msg.a || msg.p, msg.t || Date.now());

              // Update connected for this exchange
              setConnected(prev => {
                if (prev[msg.e]) return prev;
                return { ...prev, [msg.e]: true };
              });
            }
          } catch { /* ignore malformed */ }
        };

        ws.onclose = () => {
          if (aborted) return;
          wsRef.current = null;
          // Fall back to polling immediately
          startPolling();
          // Attempt reconnect with backoff
          const delay = RECONNECT_DELAYS[Math.min(reconnectAttempt.current, RECONNECT_DELAYS.length - 1)];
          reconnectAttempt.current++;
          reconnectTimer = setTimeout(connectWS, delay);
        };

        ws.onerror = () => {
          // onclose will fire after this
        };
      } catch {
        // WebSocket constructor failed — stay on polling
        startPolling();
        const delay = RECONNECT_DELAYS[Math.min(reconnectAttempt.current, RECONNECT_DELAYS.length - 1)];
        reconnectAttempt.current++;
        reconnectTimer = setTimeout(connectWS, delay);
      }
    };

    // ── Heartbeat monitor — detect silent disconnects ──
    heartbeatChecker = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        if (Date.now() - lastHeartbeat.current > HEARTBEAT_TIMEOUT_MS) {
          // No heartbeat in too long — force reconnect
          wsRef.current.close();
        }
      }
    }, HEARTBEAT_TIMEOUT_MS);

    // Start with WebSocket, fall back to polling if WS fails
    connectWS();
    // Also start polling immediately so we have data while WS connects
    startPolling();

    // ── Snapshot builder for chart history ──
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
      setPrices({});
      setConnected({});
      pendingUpdate.current = false;
      cancelAnimationFrame(rafId.current);
      if (pollTimer) clearInterval(pollTimer);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (heartbeatChecker) clearInterval(heartbeatChecker);
      clearInterval(historyTimer);
      if (wsRef.current) {
        wsRef.current.onclose = null; // prevent reconnect on intentional close
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, exchangeKey, enabled, handlePrice, updateConnectedState]);

  return { prices, connected, history, status };
}
