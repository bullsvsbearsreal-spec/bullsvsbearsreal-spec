'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  type Liquidation,
  parseBinanceLiq,
  parseBybitLiq,
  parseOKXLiq,
  parseBitgetLiq,
  parseDeribitLiq,
  parseMexcLiq,
  parseBingxLiq,
  parseHTXLiq,
  parseGTradeLiq,
  decompressGzip,
  EXCHANGE_WS_URLS,
  getSubscriptionMessages,
} from '@/lib/liquidation-parsers';

export type { Liquidation } from '@/lib/liquidation-parsers';

export interface AggregatedLiq {
  symbol: string;
  totalValue: number;
  longValue: number;
  shortValue: number;
  count: number;
}

export interface ConnectionStatus {
  exchange: string;
  connected: boolean;
  error?: string;
}

export interface LiquidationStats {
  totalLongs: number;
  totalShorts: number;
  longValue: number;
  shortValue: number;
  largestLiq: Liquidation | null;
}

interface UseMultiExchangeLiquidationsOptions {
  exchanges: string[];
  minValue: number;
  maxItems?: number;
  onLiquidation?: (liq: Liquidation) => void;
  persistKey?: string; // localStorage key for persistence
  persistTtlMs?: number; // max age of persisted data in ms
}

const RECONNECT_DELAY = 3000;

function createExchangeWS(
  exchange: string,
  onMessage: (liq: Liquidation) => void,
  onStatusChange: (connected: boolean, error?: string) => void,
): { close: () => void } {
  let ws: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let pingTimer: ReturnType<typeof setInterval> | null = null;
  let destroyed = false;

  const connect = () => {
    if (destroyed) return;

    try {
      const wsUrl = EXCHANGE_WS_URLS[exchange];
      if (!wsUrl) return;
      ws = new WebSocket(wsUrl);
    } catch {
      onStatusChange(false, 'Failed to create WebSocket');
      scheduleReconnect();
      return;
    }

    ws.onopen = () => {
      onStatusChange(true);

      // Send subscription messages
      const subMessages = getSubscriptionMessages(exchange);
      for (const msg of subMessages) {
        ws?.send(msg);
      }

      // Ping for exchanges that need it
      if (exchange === 'Bybit') {
        pingTimer = setInterval(() => {
          if (ws?.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ op: 'ping' }));
          }
        }, 20000);
      } else if (exchange === 'OKX') {
        pingTimer = setInterval(() => {
          if (ws?.readyState === WebSocket.OPEN) {
            ws.send('ping');
          }
        }, 25000);
      } else if (exchange === 'Bitget') {
        pingTimer = setInterval(() => {
          if (ws?.readyState === WebSocket.OPEN) {
            ws.send('ping');
          }
        }, 25000);
      } else if (exchange === 'Deribit') {
        pingTimer = setInterval(() => {
          if (ws?.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ jsonrpc: '2.0', id: 9999, method: 'public/test', params: {} }));
          }
        }, 25000);
      } else if (exchange === 'MEXC') {
        pingTimer = setInterval(() => {
          if (ws?.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ method: 'ping' }));
          }
        }, 20000);
      } else if (exchange === 'BingX') {
        pingTimer = setInterval(() => {
          if (ws?.readyState === WebSocket.OPEN) {
            ws.send('Ping');
          }
        }, 20000);
      } else if (exchange === 'gTrade') {
        // gTrade needs periodic text 'ping' every 25 seconds
        pingTimer = setInterval(() => {
          if (ws?.readyState === WebSocket.OPEN) {
            ws.send('ping');
          }
        }, 25000);
      }
      // HTX ping is handled via pong response to server-sent pings (in onmessage)
    };

    // HTX sends gzip-compressed binary data — need special binaryType
    if (exchange === 'HTX') {
      ws.binaryType = 'arraybuffer';
    }

    ws.onmessage = (event) => {
      try {
        // --- HTX: binary gzip decompression ---
        if (exchange === 'HTX') {
          const rawData = event.data;
          if (rawData instanceof ArrayBuffer) {
            decompressGzip(rawData).then((text) => {
              try {
                const data = JSON.parse(text);
                // Handle heartbeat ping -> respond with pong
                if (data.ping) {
                  ws?.send(JSON.stringify({ pong: data.ping }));
                  return;
                }
                // Skip subscription confirmations
                if (data.subbed || data.status === 'ok') return;
                const liq = parseHTXLiq(data);
                if (liq && liq.value > 0) {
                  onMessage(liq);
                }
              } catch { /* ignore parse errors */ }
            }).catch(() => { /* ignore decompression errors */ });
            return;
          }
          // Fallback: if somehow text data
          const data = JSON.parse(typeof rawData === 'string' ? rawData : new TextDecoder().decode(rawData));
          if (data.ping) {
            ws?.send(JSON.stringify({ pong: data.ping }));
            return;
          }
          const liq = parseHTXLiq(data);
          if (liq && liq.value > 0) onMessage(liq);
          return;
        }

        // --- gTrade: Socket.IO-style framing ---
        if (exchange === 'gTrade') {
          const rawStr = typeof event.data === 'string' ? event.data : '';
          // Socket.IO sends numeric prefixes (0, 2, 3, 40, 42, etc.)
          // Skip open/ping/pong frames
          if (rawStr === '2' || rawStr === '3' || rawStr.startsWith('0{')) return;
          // Event frame starts with '42' followed by JSON array: 42["eventName", {...}]
          if (rawStr.startsWith('42')) {
            const jsonStr = rawStr.slice(2);
            const arr = JSON.parse(jsonStr);
            if (Array.isArray(arr) && arr.length >= 2) {
              const eventName = arr[0];
              const payload = arr[1];
              if (eventName === 'unregisterTrade') {
                const liq = parseGTradeLiq({ name: 'unregisterTrade', value: payload });
                if (liq && liq.value > 0) {
                  onMessage(liq);
                }
              }
            }
            return;
          }
          // Try parsing as plain JSON as fallback
          try {
            const data = JSON.parse(rawStr);
            const liq = parseGTradeLiq(data);
            if (liq && liq.value > 0) onMessage(liq);
          } catch { /* not JSON, skip */ }
          return;
        }

        // --- All other exchanges: plain JSON ---
        // Handle pong responses (text-based)
        if (event.data === 'pong' || event.data === '{"event":"pong"}' || event.data === 'Pong') return;
        const data = JSON.parse(event.data);
        // Skip subscription confirmations, pong, and test results
        if (data.event === 'subscribe' || data.op === 'pong' || data.ret_msg === 'pong' || data.success !== undefined) return;
        // Skip Deribit JSON-RPC responses (subscription confirmations & test results)
        if (data.id !== undefined && data.result !== undefined) return;
        // Skip MEXC pong
        if (data.channel === 'pong' || data.data === 'pong') return;

        let liq: Liquidation | null = null;
        switch (exchange) {
          case 'Binance': liq = parseBinanceLiq(data); break;
          case 'Bybit': liq = parseBybitLiq(data); break;
          case 'OKX': liq = parseOKXLiq(data); break;
          case 'Bitget': liq = parseBitgetLiq(data); break;
          case 'Deribit': liq = parseDeribitLiq(data); break;
          case 'MEXC': liq = parseMexcLiq(data); break;
          case 'BingX': liq = parseBingxLiq(data); break;
        }
        if (liq && liq.value > 0) {
          onMessage(liq);
        }
      } catch {
        // Ignore parse errors
      }
    };

    ws.onerror = () => {
      onStatusChange(false, 'Connection error');
    };

    ws.onclose = () => {
      onStatusChange(false);
      cleanupPing();
      if (!destroyed) scheduleReconnect();
    };
  };

  const cleanupPing = () => {
    if (pingTimer) {
      clearInterval(pingTimer);
      pingTimer = null;
    }
  };

  const scheduleReconnect = () => {
    if (destroyed) return;
    reconnectTimer = setTimeout(connect, RECONNECT_DELAY);
  };

  connect();

  return {
    close: () => {
      destroyed = true;
      cleanupPing();
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
    },
  };
}

const EMPTY_STATS: LiquidationStats = {
  totalLongs: 0,
  totalShorts: 0,
  longValue: 0,
  shortValue: 0,
  largestLiq: null,
};

// --- localStorage persistence helpers ---
const STORAGE_VERSION = 1;

interface PersistedLiqData {
  v: number;
  ts: number; // when saved
  liquidations: Liquidation[];
  aggregated: [string, AggregatedLiq][];
  stats: LiquidationStats;
}

function saveToStorage(key: string, liquidations: Liquidation[], aggregated: Map<string, AggregatedLiq>, stats: LiquidationStats) {
  try {
    const data: PersistedLiqData = {
      v: STORAGE_VERSION,
      ts: Date.now(),
      liquidations,
      aggregated: Array.from(aggregated.entries()),
      stats: { ...stats, largestLiq: stats.largestLiq ? { ...stats.largestLiq } : null },
    };
    localStorage.setItem(key, JSON.stringify(data));
  } catch { /* quota exceeded or unavailable */ }
}

function loadFromStorage(key: string, ttlMs: number): { liquidations: Liquidation[]; aggregated: Map<string, AggregatedLiq>; stats: LiquidationStats } | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const data: PersistedLiqData = JSON.parse(raw);
    if (data.v !== STORAGE_VERSION) return null;
    // Discard if too old
    if (Date.now() - data.ts > ttlMs) {
      localStorage.removeItem(key);
      return null;
    }
    // Filter out individual liquidations older than TTL
    const cutoff = Date.now() - ttlMs;
    const liqs = data.liquidations.filter(l => l.timestamp > cutoff);
    // Recompute stats and aggregated from filtered liqs (not stale saved stats)
    const freshAgg = new Map<string, AggregatedLiq>();
    let totalLongs = 0, totalShorts = 0, longValue = 0, shortValue = 0;
    let largestLiq: Liquidation | null = null;
    for (const l of liqs) {
      const existing = freshAgg.get(l.symbol) || { symbol: l.symbol, totalValue: 0, longValue: 0, shortValue: 0, count: 0 };
      existing.totalValue += l.value;
      existing.count += 1;
      if (l.side === 'long') { existing.longValue += l.value; totalLongs++; longValue += l.value; }
      else { existing.shortValue += l.value; totalShorts++; shortValue += l.value; }
      if (!largestLiq || l.value > largestLiq.value) largestLiq = l;
      freshAgg.set(l.symbol, existing);
    }
    return {
      liquidations: liqs,
      aggregated: freshAgg,
      stats: { totalLongs, totalShorts, longValue, shortValue, largestLiq },
    };
  } catch {
    return null;
  }
}

export function useMultiExchangeLiquidations({
  exchanges,
  minValue,
  maxItems = 200,
  onLiquidation,
  persistKey = 'ih-liq-data',
  persistTtlMs = 3600000, // default 1h
}: UseMultiExchangeLiquidationsOptions) {
  // Stabilize exchanges array reference — if the parent passes a new array literal
  // with the same content on every render, we keep the previous reference to avoid
  // tearing down and reconnecting all WebSocket connections.
  const exchangesKey = exchanges.slice().sort().join(',');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableExchanges = useMemo(() => exchanges, [exchangesKey]);

  // Start with empty state for SSR, restore from localStorage after mount
  const [liquidations, setLiquidations] = useState<Liquidation[]>([]);
  const [connections, setConnections] = useState<ConnectionStatus[]>([]);
  const [stats, setStats] = useState<LiquidationStats>({ ...EMPTY_STATS });
  const [aggregated, setAggregated] = useState<Map<string, AggregatedLiq>>(new Map());
  const restoredRef = useRef(false);

  // Restore persisted data after hydration
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    const saved = loadFromStorage(persistKey, persistTtlMs);
    if (saved) {
      setLiquidations(saved.liquidations);
      setStats(saved.stats);
      setAggregated(saved.aggregated);
      liqRef.current = saved.liquidations;
      statsRef.current = saved.stats;
      aggRef.current = saved.aggregated;
    }
  }, [persistKey, persistTtlMs]);

  const minValueRef = useRef(minValue);
  const onLiquidationRef = useRef(onLiquidation);
  const maxItemsRef = useRef(maxItems);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Refs to track latest state for debounced save (avoids nested setState)
  const liqRef = useRef<Liquidation[]>([]);
  const aggRef = useRef<Map<string, AggregatedLiq>>(new Map());
  const statsRef = useRef<LiquidationStats>({ ...EMPTY_STATS });

  useEffect(() => { minValueRef.current = minValue; }, [minValue]);
  useEffect(() => { onLiquidationRef.current = onLiquidation; }, [onLiquidation]);
  useEffect(() => { maxItemsRef.current = maxItems; }, [maxItems]);

  const handleLiquidation = useCallback((liq: Liquidation) => {
    if (liq.value < minValueRef.current) return;

    setLiquidations(prev => {
      const next = [liq, ...prev].slice(0, maxItemsRef.current);
      liqRef.current = next;
      return next;
    });

    setAggregated(prev => {
      const newMap = new Map(prev);
      const old = newMap.get(liq.symbol) || {
        symbol: liq.symbol, totalValue: 0, longValue: 0, shortValue: 0, count: 0,
      };
      // Clone to avoid mutating previous state (shallow Map clone shares object refs)
      const existing = { ...old };
      existing.totalValue += liq.value;
      existing.count += 1;
      if (liq.side === 'long') existing.longValue += liq.value;
      else existing.shortValue += liq.value;
      newMap.set(liq.symbol, existing);
      aggRef.current = newMap;
      return newMap;
    });

    setStats(prev => {
      const next = {
        totalLongs: prev.totalLongs + (liq.side === 'long' ? 1 : 0),
        totalShorts: prev.totalShorts + (liq.side === 'short' ? 1 : 0),
        longValue: prev.longValue + (liq.side === 'long' ? liq.value : 0),
        shortValue: prev.shortValue + (liq.side === 'short' ? liq.value : 0),
        largestLiq: !prev.largestLiq || liq.value > prev.largestLiq.value ? liq : prev.largestLiq,
      };
      statsRef.current = next;
      return next;
    });

    onLiquidationRef.current?.(liq);

    // Debounced save to localStorage (every 2s max)
    // Read from refs instead of nested setState callbacks to avoid extra re-renders
    if (!saveTimerRef.current) {
      saveTimerRef.current = setTimeout(() => {
        saveTimerRef.current = null;
        saveToStorage(persistKey, liqRef.current, aggRef.current, statsRef.current);
      }, 2000);
    }
  }, [persistKey]);

  useEffect(() => {
    // Initialize connections status
    setConnections(stableExchanges.map(ex => ({ exchange: ex, connected: false })));

    const wsHandles = stableExchanges.map(exchange => {
      return createExchangeWS(
        exchange,
        handleLiquidation,
        (connected, error) => {
          setConnections(prev =>
            prev.map(c => c.exchange === exchange ? { ...c, connected, error } : c),
          );
        },
      );
    });

    return () => {
      wsHandles.forEach(h => h.close());
      // Clear any pending save timer on unmount
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [stableExchanges, handleLiquidation]);

  const clearAll = useCallback(() => {
    setLiquidations([]);
    setAggregated(new Map());
    setStats({ ...EMPTY_STATS });
    liqRef.current = [];
    aggRef.current = new Map();
    statsRef.current = { ...EMPTY_STATS };
    try { localStorage.removeItem(persistKey); } catch {}
  }, [persistKey]);

  /**
   * Load historical liquidations from DB — replaces current state and recomputes
   * aggregated + stats. Subsequent WS events append on top as normal.
   */
  const loadHistorical = useCallback((liqs: Liquidation[]) => {
    setLiquidations(liqs);
    liqRef.current = liqs;

    // Recompute aggregated map
    const newAgg = new Map<string, AggregatedLiq>();
    for (const liq of liqs) {
      const existing = newAgg.get(liq.symbol) || {
        symbol: liq.symbol, totalValue: 0, longValue: 0, shortValue: 0, count: 0,
      };
      existing.totalValue += liq.value;
      existing.count += 1;
      if (liq.side === 'long') existing.longValue += liq.value;
      else existing.shortValue += liq.value;
      newAgg.set(liq.symbol, existing);
    }
    setAggregated(newAgg);
    aggRef.current = newAgg;

    // Recompute stats
    let largestLiq: Liquidation | null = null;
    let totalLongs = 0, totalShorts = 0, longValue = 0, shortValue = 0;
    for (const liq of liqs) {
      if (liq.side === 'long') { totalLongs++; longValue += liq.value; }
      else { totalShorts++; shortValue += liq.value; }
      if (!largestLiq || liq.value > largestLiq.value) largestLiq = liq;
    }
    const newStats = { totalLongs, totalShorts, longValue, shortValue, largestLiq };
    setStats(newStats);
    statsRef.current = newStats;

    // Save to localStorage
    saveToStorage(persistKey, liqs, newAgg, { totalLongs, totalShorts, longValue, shortValue, largestLiq });
  }, [persistKey]);

  return { liquidations, connections, stats, aggregated, clearAll, loadHistorical };
}
