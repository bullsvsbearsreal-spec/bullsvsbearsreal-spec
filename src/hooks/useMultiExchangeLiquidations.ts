'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export interface Liquidation {
  id: string;
  symbol: string;
  side: 'long' | 'short';
  price: number;
  quantity: number;
  value: number;
  exchange: string;
  timestamp: number;
}

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
}

const RECONNECT_DELAY = 3000;

// Top symbols to subscribe to on Bybit (subscribes per-symbol)
const BYBIT_SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'DOGEUSDT',
  'BNBUSDT', 'ADAUSDT', 'AVAXUSDT', 'DOTUSDT', 'LINKUSDT',
  'MATICUSDT', 'LTCUSDT', 'UNIUSDT', 'APTUSDT', 'ARBUSDT',
  'OPUSDT', 'NEARUSDT', 'FILUSDT', 'ATOMUSDT', 'INJUSDT',
  'SUIUSDT', 'PEPEUSDT', 'WIFUSDT', 'SEIUSDT', 'TIAUSDT',
];

function parseBinanceLiq(data: any): Liquidation | null {
  if (data.e !== 'forceOrder') return null;
  const o = data.o;
  const price = parseFloat(o.p);
  const qty = parseFloat(o.q);
  return {
    id: `bin-${o.s}-${o.T}`,
    symbol: o.s.replace('USDT', '').replace('USDC', ''),
    side: o.S === 'BUY' ? 'short' : 'long',
    price,
    quantity: qty,
    value: price * qty,
    exchange: 'Binance',
    timestamp: o.T,
  };
}

function parseBybitLiq(data: any): Liquidation | null {
  if (!data.topic?.startsWith('liquidation.')) return null;
  const d = data.data;
  if (!d) return null;
  const price = parseFloat(d.price);
  const size = parseFloat(d.size);
  return {
    id: `byb-${d.symbol}-${d.updatedTime}`,
    symbol: d.symbol.replace('USDT', '').replace('USDC', ''),
    side: d.side === 'Buy' ? 'short' : 'long',
    price,
    quantity: size,
    value: price * size,
    exchange: 'Bybit',
    timestamp: d.updatedTime,
  };
}

function parseOKXLiq(data: any): Liquidation | null {
  if (!data.arg || data.arg.channel !== 'liquidation-orders') return null;
  const items = data.data;
  if (!items || items.length === 0) return null;
  const d = items[0];
  // OKX details are nested in details array
  const details = d.details;
  if (!details || details.length === 0) return null;
  const detail = details[0];
  const price = parseFloat(detail.bkPx);
  const size = parseFloat(detail.sz);
  const instId = d.instId || '';
  const symbol = instId.replace('-USDT-SWAP', '').replace('-USDC-SWAP', '').replace('-', '');
  return {
    id: `okx-${instId}-${detail.ts}`,
    symbol,
    side: detail.side === 'buy' ? 'short' : 'long',
    price,
    quantity: size,
    value: price * size,
    exchange: 'OKX',
    timestamp: parseInt(detail.ts, 10),
  };
}

function parseBitgetLiq(data: any): Liquidation | null {
  if (!data.data || !Array.isArray(data.data) || data.data.length === 0) return null;
  const d = data.data[0];
  const price = parseFloat(d.bkPx || d.fillPx || '0');
  const size = parseFloat(d.sz || d.fillSz || '0');
  const instId = d.instId || d.symbol || '';
  const symbol = instId.replace('USDT', '').replace('USDC', '').replace('_UMCBL', '');
  return {
    id: `bg-${instId}-${d.uTime || d.ts || Date.now()}`,
    symbol,
    side: d.side === 'buy' ? 'short' : 'long',
    price,
    quantity: size,
    value: price * size,
    exchange: 'Bitget',
    timestamp: parseInt(d.uTime || d.ts || String(Date.now()), 10),
  };
}

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
      switch (exchange) {
        case 'Binance':
          ws = new WebSocket('wss://fstream.binance.com/ws/!forceOrder@arr');
          break;
        case 'Bybit':
          ws = new WebSocket('wss://stream.bybit.com/v5/public/linear');
          break;
        case 'OKX':
          ws = new WebSocket('wss://ws.okx.com:8443/ws/v5/public');
          break;
        case 'Bitget':
          ws = new WebSocket('wss://ws.bitget.com/v2/ws/public');
          break;
        default:
          return;
      }
    } catch {
      onStatusChange(false, 'Failed to create WebSocket');
      scheduleReconnect();
      return;
    }

    ws.onopen = () => {
      onStatusChange(true);

      // Send subscription messages
      if (exchange === 'Bybit') {
        const args = BYBIT_SYMBOLS.map(s => `liquidation.${s}`);
        ws?.send(JSON.stringify({ op: 'subscribe', args }));
      } else if (exchange === 'OKX') {
        ws?.send(JSON.stringify({
          op: 'subscribe',
          args: [{ channel: 'liquidation-orders', instType: 'SWAP' }],
        }));
      } else if (exchange === 'Bitget') {
        ws?.send(JSON.stringify({
          op: 'subscribe',
          args: [{ instType: 'USDT-FUTURES', channel: 'liquidation', instId: 'default' }],
        }));
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
      }
    };

    ws.onmessage = (event) => {
      try {
        // Handle pong responses
        if (event.data === 'pong' || event.data === '{"event":"pong"}') return;
        const data = JSON.parse(event.data);
        // Skip subscription confirmations and pong
        if (data.event === 'subscribe' || data.op === 'pong' || data.ret_msg === 'pong' || data.success !== undefined) return;

        let liq: Liquidation | null = null;
        switch (exchange) {
          case 'Binance': liq = parseBinanceLiq(data); break;
          case 'Bybit': liq = parseBybitLiq(data); break;
          case 'OKX': liq = parseOKXLiq(data); break;
          case 'Bitget': liq = parseBitgetLiq(data); break;
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

export function useMultiExchangeLiquidations({
  exchanges,
  minValue,
  maxItems = 200,
  onLiquidation,
}: UseMultiExchangeLiquidationsOptions) {
  const [liquidations, setLiquidations] = useState<Liquidation[]>([]);
  const [connections, setConnections] = useState<ConnectionStatus[]>([]);
  const [stats, setStats] = useState<LiquidationStats>({ ...EMPTY_STATS });
  const [aggregated, setAggregated] = useState<Map<string, AggregatedLiq>>(new Map());

  const minValueRef = useRef(minValue);
  const onLiquidationRef = useRef(onLiquidation);
  const maxItemsRef = useRef(maxItems);

  useEffect(() => { minValueRef.current = minValue; }, [minValue]);
  useEffect(() => { onLiquidationRef.current = onLiquidation; }, [onLiquidation]);
  useEffect(() => { maxItemsRef.current = maxItems; }, [maxItems]);

  const handleLiquidation = useCallback((liq: Liquidation) => {
    if (liq.value < minValueRef.current) return;

    setLiquidations(prev => [liq, ...prev].slice(0, maxItemsRef.current));

    setAggregated(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(liq.symbol) || {
        symbol: liq.symbol, totalValue: 0, longValue: 0, shortValue: 0, count: 0,
      };
      existing.totalValue += liq.value;
      existing.count += 1;
      if (liq.side === 'long') existing.longValue += liq.value;
      else existing.shortValue += liq.value;
      newMap.set(liq.symbol, existing);
      return newMap;
    });

    setStats(prev => ({
      totalLongs: prev.totalLongs + (liq.side === 'long' ? 1 : 0),
      totalShorts: prev.totalShorts + (liq.side === 'short' ? 1 : 0),
      longValue: prev.longValue + (liq.side === 'long' ? liq.value : 0),
      shortValue: prev.shortValue + (liq.side === 'short' ? liq.value : 0),
      largestLiq: !prev.largestLiq || liq.value > prev.largestLiq.value ? liq : prev.largestLiq,
    }));

    onLiquidationRef.current?.(liq);
  }, []);

  useEffect(() => {
    // Initialize connections status
    setConnections(exchanges.map(ex => ({ exchange: ex, connected: false })));

    const wsHandles = exchanges.map(exchange => {
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
    };
  }, [exchanges, handleLiquidation]);

  const clearAll = useCallback(() => {
    setLiquidations([]);
    setAggregated(new Map());
    setStats({ ...EMPTY_STATS });
  }, []);

  return { liquidations, connections, stats, aggregated, clearAll };
}
