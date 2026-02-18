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
  persistKey?: string; // localStorage key for persistence
  persistTtlMs?: number; // max age of persisted data in ms
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

// Top symbols for BingX (per-symbol subscription required)
const BINGX_SYMBOLS = ['BTC-USDT', 'ETH-USDT', 'SOL-USDT', 'XRP-USDT', 'DOGE-USDT'];

// Top symbols for HTX linear swap liquidation feed
const HTX_LIQ_SYMBOLS = [
  'BTC-USDT', 'ETH-USDT', 'SOL-USDT', 'XRP-USDT', 'DOGE-USDT',
  'BNB-USDT', 'ADA-USDT', 'AVAX-USDT', 'LINK-USDT', 'DOT-USDT',
  'LTC-USDT', 'UNI-USDT', 'APT-USDT', 'ARB-USDT', 'OP-USDT',
  'SUI-USDT', 'PEPE-USDT', 'WIF-USDT', 'INJ-USDT', 'NEAR-USDT',
];

// --- Browser-native gzip decompression for HTX ---
async function decompressGzip(data: ArrayBuffer): Promise<string> {
  const ds = new DecompressionStream('gzip');
  const writer = ds.writable.getWriter();
  writer.write(new Uint8Array(data));
  writer.close();
  const reader = ds.readable.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) { merged.set(c, offset); offset += c.length; }
  return new TextDecoder().decode(merged);
}

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

function parseDeribitLiq(data: any): Liquidation | null {
  // JSON-RPC subscription notification
  if (data.method !== 'subscription' || !data.params?.data) return null;
  const d = data.params.data;
  const instrument = d.instrument_name || '';
  // Extract symbol: BTC-PERPETUAL -> BTC, ETH-PERPETUAL -> ETH
  const symbol = instrument.split('-')[0];
  if (!symbol) return null;
  const price = parseFloat(d.price || '0');
  const quantity = parseFloat(d.quantity || d.amount || '0');
  return {
    id: `drb-${instrument}-${d.timestamp || Date.now()}`,
    symbol,
    side: d.direction === 'buy' ? 'short' : 'long',
    price,
    quantity,
    value: price * quantity,
    exchange: 'Deribit',
    timestamp: d.timestamp || Date.now(),
  };
}

function parseMexcLiq(data: any): Liquidation | null {
  if (data.channel !== 'push.liquidation.order' || !data.data) return null;
  const d = data.data;
  const rawSymbol = d.symbol || '';
  const symbol = rawSymbol.replace('_USDT', '').replace('_USDC', '');
  const price = parseFloat(d.price || d.liquidationPrice || '0');
  const quantity = parseFloat(d.vol || d.quantity || '0');
  return {
    id: `mexc-${rawSymbol}-${d.createTime || Date.now()}`,
    symbol,
    side: (d.side === 1 || d.side === 'Buy' || d.side === 'buy') ? 'short' : 'long',
    price,
    quantity,
    value: price * quantity,
    exchange: 'MEXC',
    timestamp: d.createTime || Date.now(),
  };
}

function parseBingxLiq(data: any): Liquidation | null {
  if (!data.dataType?.includes('forceOrder') || !data.data) return null;
  const d = data.data;
  const rawSymbol = d.s || d.symbol || '';
  const symbol = rawSymbol.replace('-USDT', '').replace('-USDC', '');
  const price = parseFloat(d.p || d.price || '0');
  const quantity = parseFloat(d.q || d.quantity || '0');
  return {
    id: `bx-${rawSymbol}-${d.T || d.timestamp || Date.now()}`,
    symbol,
    side: (d.S === 'BUY' || d.S === 'Buy') ? 'short' : 'long',
    price,
    quantity,
    value: price * quantity,
    exchange: 'BingX',
    timestamp: d.T || d.timestamp || Date.now(),
  };
}

function parseHTXLiq(data: any): Liquidation | null {
  // HTX sends data array inside a channel message
  // { "ch": "public.BTC-USDT.liquidation_orders", "ts": ..., "data": [...] }
  if (!data.ch || !data.data || !Array.isArray(data.data) || data.data.length === 0) return null;
  const d = data.data[0];
  const contractCode = d.contract_code || '';
  const symbol = contractCode.replace('-USDT', '').replace('-USDC', '');
  if (!symbol) return null;
  const price = parseFloat(d.price || '0');
  const amount = parseFloat(d.amount || '0'); // amount is in tokens
  const direction = d.direction; // 'sell' or 'buy'
  const offset = d.offset; // 'close' means liquidation
  // direction === 'sell' + offset === 'close' -> long liquidation (forced sell of long)
  // direction === 'buy' + offset === 'close' -> short liquidation (forced buy of short)
  let side: 'long' | 'short';
  if (direction === 'sell' && offset === 'close') {
    side = 'long';
  } else if (direction === 'buy' && offset === 'close') {
    side = 'short';
  } else {
    return null; // not a liquidation close
  }
  return {
    id: `htx-${contractCode}-${d.created_at || data.ts || Date.now()}`,
    symbol,
    side,
    price,
    quantity: amount,
    value: price * amount,
    exchange: 'HTX',
    timestamp: d.created_at || data.ts || Date.now(),
  };
}

function parseGTradeLiq(data: any): Liquidation | null {
  // gTrade sends Socket.IO-style messages. We look for unregisterTrade with liq closeType.
  // The data may come as: { name: 'unregisterTrade', value: { ... } }
  // or already parsed from a Socket.IO frame.
  if (!data) return null;

  // Try to extract the trade data
  let trade: any = null;
  if (data.name === 'unregisterTrade' && data.value) {
    trade = data.value;
  } else if (data.closeType) {
    // Direct trade object
    trade = data;
  } else {
    return null;
  }

  // Only process liquidations
  const closeType = (trade.closeType || '').toLowerCase();
  if (closeType !== 'liq' && closeType !== 'liquidation' && closeType !== 'liquidated') return null;

  // Extract symbol from pair field: "BTC/USD" -> "BTC"
  const pair = trade.pair || trade.pairName || '';
  const symbol = pair.split('/')[0] || '';
  if (!symbol) return null;

  // Determine side: if the liquidated trade was long, it's a long liquidation
  const isLong = trade.buy === true || trade.long === true || trade.side === 'long';
  const side: 'long' | 'short' = isLong ? 'long' : 'short';

  // Calculate value
  const positionSize = parseFloat(trade.positionSizeStable || trade.positionSizeDai || '0');
  const collateral = parseFloat(trade.collateralAmount || trade.initialPosToken || '0');
  const leverage = parseFloat(trade.leverage || '1');
  const value = positionSize > 0 ? positionSize : collateral * leverage;
  const price = parseFloat(trade.closePrice || trade.currentPrice || trade.openPrice || '0');
  const quantity = price > 0 ? value / price : 0;

  return {
    id: `gt-${symbol}-${trade.tradeId || trade.orderId || Date.now()}-${Date.now()}`,
    symbol,
    side,
    price,
    quantity,
    value,
    exchange: 'gTrade',
    timestamp: trade.closeTimestamp ? parseInt(trade.closeTimestamp, 10) : Date.now(),
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
        case 'Deribit':
          ws = new WebSocket('wss://www.deribit.com/ws/api/v2');
          break;
        case 'MEXC':
          ws = new WebSocket('wss://contract.mexc.com/edge');
          break;
        case 'BingX':
          ws = new WebSocket('wss://open-api-ws.bingx.com/market');
          break;
        case 'HTX':
          ws = new WebSocket('wss://api.hbdm.com/linear-swap-ws');
          break;
        case 'gTrade':
          ws = new WebSocket('wss://backend-arbitrum.gains.trade');
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
      } else if (exchange === 'Deribit') {
        // JSON-RPC subscribe to BTC + ETH perpetual liquidations
        ws?.send(JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'public/subscribe',
          params: { channels: ['trades.BTC-PERPETUAL.raw', 'trades.ETH-PERPETUAL.raw'] },
        }));
        // Also try liquidation-specific channels
        ws?.send(JSON.stringify({
          jsonrpc: '2.0',
          id: 2,
          method: 'public/subscribe',
          params: { channels: ['liquidations.BTC-PERPETUAL.raw', 'liquidations.ETH-PERPETUAL.raw'] },
        }));
      } else if (exchange === 'MEXC') {
        ws?.send(JSON.stringify({ method: 'sub.liquidation.order', param: {} }));
      } else if (exchange === 'BingX') {
        // BingX needs per-symbol subscriptions
        BINGX_SYMBOLS.forEach((sym, i) => {
          ws?.send(JSON.stringify({
            id: `bingx-${i}`,
            reqType: 'sub',
            dataType: `${sym}@forceOrder`,
          }));
        });
      } else if (exchange === 'HTX') {
        // HTX needs per-symbol subscriptions for liquidation orders
        HTX_LIQ_SYMBOLS.forEach((sym, i) => {
          ws?.send(JSON.stringify({
            sub: `public.${sym}.liquidation_orders`,
            id: `htx-${i}`,
          }));
        });
      }
      // gTrade: no subscription needed, server pushes on connect

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
    return {
      liquidations: liqs,
      aggregated: new Map(data.aggregated),
      stats: data.stats,
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
  // Restore from localStorage on mount
  const restored = useRef(false);
  const initData = useRef<ReturnType<typeof loadFromStorage>>(null);
  if (!restored.current) {
    initData.current = loadFromStorage(persistKey, persistTtlMs);
    restored.current = true;
  }

  const [liquidations, setLiquidations] = useState<Liquidation[]>(initData.current?.liquidations ?? []);
  const [connections, setConnections] = useState<ConnectionStatus[]>([]);
  const [stats, setStats] = useState<LiquidationStats>(initData.current?.stats ?? { ...EMPTY_STATS });
  const [aggregated, setAggregated] = useState<Map<string, AggregatedLiq>>(initData.current?.aggregated ?? new Map());

  const minValueRef = useRef(minValue);
  const onLiquidationRef = useRef(onLiquidation);
  const maxItemsRef = useRef(maxItems);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

    // Debounced save to localStorage (every 2s max)
    if (!saveTimerRef.current) {
      saveTimerRef.current = setTimeout(() => {
        saveTimerRef.current = null;
        // Read current state via setState callback to get latest values
        setLiquidations(cur => {
          setAggregated(curAgg => {
            setStats(curStats => {
              saveToStorage(persistKey, cur, curAgg, curStats);
              return curStats;
            });
            return curAgg;
          });
          return cur;
        });
      }, 2000);
    }
  }, [persistKey]);

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
    try { localStorage.removeItem(persistKey); } catch {}
  }, [persistKey]);

  return { liquidations, connections, stats, aggregated, clearAll };
}
