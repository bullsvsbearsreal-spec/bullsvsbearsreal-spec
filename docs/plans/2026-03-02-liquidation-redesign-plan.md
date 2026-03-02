# Liquidation Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the liquidations page into a multi-panel trading terminal backed by a 24/7 PM2 WebSocket worker that stores ALL liquidation events to PostgreSQL in real-time.

**Architecture:** Standalone Node.js worker connects to 9 exchange WebSocket feeds, buffers events, and batch-inserts into the existing `liquidation_snapshots` table every 2 seconds. The Next.js frontend polls the DB via API (SWR, 5s interval) to display a multi-panel dashboard: treemap heatmap + history chart + live feed, all visible simultaneously.

**Tech Stack:** Node.js, `ws` (WebSocket client), `postgres` (Postgres.js), PM2, Next.js 14, SWR, Recharts, Tailwind CSS

---

## Task 1: Extract Liquidation Parsers to Shared Module

**Files:**
- Create: `src/lib/liquidation-parsers.ts`
- Modify: `src/hooks/useMultiExchangeLiquidations.ts` (lines 89-310)

**Step 1: Create the shared parser module**

Create `src/lib/liquidation-parsers.ts` by extracting all parser functions from the hook. Include the `Liquidation` interface and all 9 parser functions: `parseBinanceLiq`, `parseBybitLiq`, `parseOKXLiq`, `parseBitgetLiq`, `parseDeribitLiq`, `parseMexcLiq`, `parseBingxLiq`, `parseHTXLiq`, `parseGTradeLiq`.

Also extract the `decompressGzip` helper, the symbol subscription lists (`BYBIT_SYMBOLS`, `BINGX_SYMBOLS`, `HTX_LIQ_SYMBOLS`), and the exchange WebSocket URLs as a config map.

Export everything. The interface stays identical:

```typescript
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

export const EXCHANGE_WS_URLS: Record<string, string> = {
  Binance: 'wss://fstream.binance.com/ws/!forceOrder@arr',
  Bybit: 'wss://stream.bybit.com/v5/public/linear',
  OKX: 'wss://ws.okx.com:8443/ws/v5/public',
  Bitget: 'wss://ws.bitget.com/v2/ws/public',
  Deribit: 'wss://www.deribit.com/ws/api/v2',
  MEXC: 'wss://contract.mexc.com/edge',
  BingX: 'wss://open-api-ws.bingx.com/market',
  HTX: 'wss://api.hbdm.com/linear-swap-ws',
  gTrade: 'wss://backend-arbitrum.gains.trade',
};

// Also export subscription message builders
export function getSubscriptionMessages(exchange: string): string[] { ... }
```

**Step 2: Update the hook to import from shared module**

In `src/hooks/useMultiExchangeLiquidations.ts`:
- Remove all parser function definitions (lines 89-310)
- Remove `BYBIT_SYMBOLS`, `BINGX_SYMBOLS`, `HTX_LIQ_SYMBOLS` (lines 50-67)
- Remove `decompressGzip` (lines 70-87)
- Add: `import { Liquidation, parseBinanceLiq, parseBybitLiq, ... } from '@/lib/liquidation-parsers'`
- Keep the `createExchangeWS` function but update it to use imported parsers and `EXCHANGE_WS_URLS`
- Re-export `Liquidation` type from the hook (for backward compatibility)

**Step 3: Verify build passes**

Run: `npm run build`
Expected: Clean build, no errors.

**Step 4: Run existing tests**

Run: `npm run test:unit`
Expected: All tests pass (parsers are internal, no unit tests yet).

**Step 5: Commit**

```bash
git add src/lib/liquidation-parsers.ts src/hooks/useMultiExchangeLiquidations.ts
git commit -m "refactor: extract liquidation parsers to shared module"
```

---

## Task 2: Add DB Functions — Treemap Query + Enhanced Feed

**Files:**
- Modify: `src/lib/db/index.ts` (add 2 new functions after line ~542)
- Modify: `src/app/api/history/liquidations/route.ts` (add treemap mode, enhance feed mode)

**Step 1: Add `getLiquidationTreemap` DB function**

In `src/lib/db/index.ts`, after the `getAllRecentLiquidations` function (~line 542), add:

```typescript
/**
 * Get aggregated liquidation data grouped by symbol for treemap visualization.
 * Returns: symbol, total value, long value, short value, count.
 */
export async function getLiquidationTreemap(
  hours: number,
  limit: number = 30,
): Promise<Array<{
  symbol: string;
  totalValue: number;
  longValue: number;
  shortValue: number;
  count: number;
}>> {
  try {
    const sql = getSQL();
    const intervalStr = `${hours} hours`;
    const rows = await sql`
      SELECT
        symbol,
        SUM(value_usd) AS total_value,
        SUM(CASE WHEN side = 'long' THEN value_usd ELSE 0 END) AS long_value,
        SUM(CASE WHEN side = 'short' THEN value_usd ELSE 0 END) AS short_value,
        COUNT(*) AS count
      FROM liquidation_snapshots
      WHERE ts > NOW() - ${intervalStr}::interval
      GROUP BY symbol
      HAVING SUM(value_usd) > 0
      ORDER BY total_value DESC
      LIMIT ${limit}
    `;
    return rows.map((r: any) => ({
      symbol: r.symbol as string,
      totalValue: Number(r.total_value),
      longValue: Number(r.long_value),
      shortValue: Number(r.short_value),
      count: Number(r.count),
    }));
  } catch (e) {
    console.error('DB getLiquidationTreemap error:', e);
    return [];
  }
}
```

**Step 2: Add `getLiquidationFeedFiltered` DB function**

Below the treemap function, add:

```typescript
/**
 * Get recent liquidation events with optional exchange and side filters.
 */
export async function getLiquidationFeedFiltered(
  hours: number,
  limit: number = 200,
  exchange?: string,
  side?: 'long' | 'short',
): Promise<Array<{
  symbol: string;
  exchange: string;
  side: 'long' | 'short';
  price: number;
  quantity: number;
  valueUsd: number;
  ts: number;
}>> {
  try {
    const sql = getSQL();
    const intervalStr = `${hours} hours`;
    const rows = await sql`
      SELECT symbol, exchange, side, price, quantity, value_usd,
             EXTRACT(EPOCH FROM ts) * 1000 AS ts_ms
      FROM liquidation_snapshots
      WHERE ts > NOW() - ${intervalStr}::interval
        ${exchange ? sql`AND exchange = ${exchange}` : sql``}
        ${side ? sql`AND side = ${side}` : sql``}
      ORDER BY ts DESC
      LIMIT ${limit}
    `;
    return rows.map((r: any) => ({
      symbol: r.symbol as string,
      exchange: r.exchange as string,
      side: r.side as 'long' | 'short',
      price: Number(r.price),
      quantity: Number(r.quantity),
      valueUsd: Number(r.value_usd),
      ts: Number(r.ts_ms),
    }));
  } catch (e) {
    console.error('DB getLiquidationFeedFiltered error:', e);
    return [];
  }
}
```

**Step 3: Add exports for new functions**

Make sure both functions are exported (they use `export async function` already).

**Step 4: Update the API route**

In `src/app/api/history/liquidations/route.ts`, add the import for the new functions:

```typescript
import {
  isDBConfigured,
  getLiquidationHistory,
  getLiquidationsByExchange,
  getTopLiquidatedSymbols,
  getAllRecentLiquidations,
  getLiquidationTreemap,
  getLiquidationFeedFiltered,
} from '@/lib/db';
```

Add a treemap handler before the feed handler (after line 40):

```typescript
// Treemap mode — aggregated by symbol
if (mode === 'treemap') {
  const hours = Math.min(parseInt(searchParams.get('hours') || '1') || 1, 72);
  const treemapLimit = Math.min(parseInt(searchParams.get('limit') || '30') || 30, 50);
  const data = await getLiquidationTreemap(hours, treemapLimit);
  return NextResponse.json({ mode: 'treemap', hours, data, count: data.length }, {
    headers: { 'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=10' },
  });
}
```

Enhance the feed handler to accept `exchange` and `side` filters:

```typescript
if (mode === 'feed') {
  const hours = Math.min(parseInt(searchParams.get('hours') || '1') || 1, 72);
  const feedLimit = Math.min(parseInt(searchParams.get('limit') || '200') || 200, 1000);
  const exchange = searchParams.get('exchange') || undefined;
  const side = searchParams.get('side') as 'long' | 'short' | undefined;
  const validSide = side === 'long' || side === 'short' ? side : undefined;
  const data = await getLiquidationFeedFiltered(hours, feedLimit, exchange, validSide);
  return NextResponse.json({ mode: 'feed', hours, data, count: data.length }, {
    headers: { 'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=10' },
  });
}
```

**Step 5: Verify build**

Run: `npm run build`
Expected: Clean build.

**Step 6: Commit**

```bash
git add src/lib/db/index.ts src/app/api/history/liquidations/route.ts
git commit -m "feat: add treemap + filtered feed DB functions and API modes"
```

---

## Task 3: Create the PM2 WebSocket Worker

**Files:**
- Create: `workers/liquidation-ingester.ts`
- Create: `workers/ecosystem.config.js`
- Modify: `package.json` (add `ws` dependency + worker script)

**Step 1: Install ws dependency**

Run: `npm install ws && npm install -D @types/ws`

**Step 2: Create the worker**

Create `workers/liquidation-ingester.ts`:

```typescript
/**
 * Standalone WebSocket liquidation ingester.
 * Connects to 9 exchange WS feeds, buffers events, batch-inserts to PostgreSQL.
 * Run with PM2: pm2 start ecosystem.config.js
 */
import WebSocket from 'ws';
import postgres from 'postgres';
import {
  Liquidation,
  EXCHANGE_WS_URLS,
  BYBIT_SYMBOLS,
  BINGX_SYMBOLS,
  HTX_LIQ_SYMBOLS,
  parseBinanceLiq,
  parseBybitLiq,
  parseOKXLiq,
  parseBitgetLiq,
  parseDeribitLiq,
  parseMexcLiq,
  parseBingxLiq,
  parseHTXLiq,
  parseGTradeLiq,
  getSubscriptionMessages,
} from '../src/lib/liquidation-parsers';

// ─── Config ────────────────────────────────────────
const DATABASE_URL = process.env.DATABASE_URL || '';
const FLUSH_INTERVAL_MS = 2000;
const RECONNECT_DELAY_MS = 3000;
const HEALTH_LOG_INTERVAL_MS = 60000;
const EXCHANGES = Object.keys(EXCHANGE_WS_URLS);

if (!DATABASE_URL) {
  console.error('FATAL: DATABASE_URL not set');
  process.exit(1);
}

const sql = postgres(DATABASE_URL, {
  max: 5,
  idle_timeout: 20,
  connect_timeout: 10,
  ssl: 'require',
});

// ─── Buffer ────────────────────────────────────────
let buffer: Liquidation[] = [];
let totalIngested = 0;
let totalFlushed = 0;

async function flushBuffer() {
  if (buffer.length === 0) return;
  const batch = buffer.splice(0); // take all
  try {
    // Batch insert in chunks of 50
    for (let i = 0; i < batch.length; i += 50) {
      const chunk = batch.slice(i, i + 50);
      const promises = chunk.map(liq => {
        const ts = new Date(liq.timestamp).toISOString();
        return sql`
          INSERT INTO liquidation_snapshots (symbol, exchange, side, price, quantity, value_usd, ts)
          VALUES (${liq.symbol}, ${liq.exchange}, ${liq.side}, ${liq.price}, ${liq.quantity}, ${liq.value}, ${ts})
          ON CONFLICT (symbol, exchange, side, price, ts) DO NOTHING
        `;
      });
      await Promise.all(promises);
    }
    totalFlushed += batch.length;
  } catch (e) {
    console.error(`[FLUSH] Error writing ${batch.length} events:`, e);
    // Put failed items back at end of buffer for retry
    buffer.push(...batch);
  }
}

setInterval(flushBuffer, FLUSH_INTERVAL_MS);

// ─── WebSocket Connections ─────────────────────────
const connectionStatus: Record<string, boolean> = {};

function handleLiquidation(liq: Liquidation) {
  if (liq.value <= 0 || liq.price <= 0) return;
  buffer.push(liq);
  totalIngested++;
}

// Decompress gzip for HTX (Node.js version using zlib)
import { gunzipSync } from 'zlib';

function connectExchange(exchange: string) {
  const url = EXCHANGE_WS_URLS[exchange];
  if (!url) return;

  let destroyed = false;
  let pingTimer: ReturnType<typeof setInterval> | null = null;

  const connect = () => {
    if (destroyed) return;
    const ws = new WebSocket(url);

    ws.on('open', () => {
      connectionStatus[exchange] = true;
      console.log(`[WS] ${exchange} connected`);

      // Send subscription messages
      const msgs = getSubscriptionMessages(exchange);
      msgs.forEach(msg => ws.send(msg));

      // Ping timers
      if (['Bybit', 'MEXC', 'BingX'].includes(exchange)) {
        pingTimer = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            const pingMsg = exchange === 'Bybit' ? JSON.stringify({ op: 'ping' })
              : exchange === 'MEXC' ? JSON.stringify({ method: 'ping' })
              : 'Ping';
            ws.send(pingMsg);
          }
        }, 20000);
      } else if (['OKX', 'Bitget', 'gTrade'].includes(exchange)) {
        pingTimer = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send('ping');
        }, 25000);
      } else if (exchange === 'Deribit') {
        pingTimer = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ jsonrpc: '2.0', id: 9999, method: 'public/test', params: {} }));
          }
        }, 25000);
      }
      // HTX ping handled in message handler
    });

    ws.on('message', (raw: WebSocket.RawData) => {
      try {
        // HTX: binary gzip
        if (exchange === 'HTX') {
          const buf = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as ArrayBuffer);
          const text = gunzipSync(buf).toString('utf-8');
          const data = JSON.parse(text);
          if (data.ping) { ws.send(JSON.stringify({ pong: data.ping })); return; }
          if (data.subbed || data.status === 'ok') return;
          const liq = parseHTXLiq(data);
          if (liq && liq.value > 0) handleLiquidation(liq);
          return;
        }

        // gTrade: Socket.IO framing
        if (exchange === 'gTrade') {
          const str = raw.toString();
          if (str === '2' || str === '3' || str.startsWith('0{')) return;
          if (str.startsWith('42')) {
            const arr = JSON.parse(str.slice(2));
            if (Array.isArray(arr) && arr.length >= 2 && arr[0] === 'unregisterTrade') {
              const liq = parseGTradeLiq({ name: 'unregisterTrade', value: arr[1] });
              if (liq && liq.value > 0) handleLiquidation(liq);
            }
            return;
          }
          try {
            const data = JSON.parse(str);
            const liq = parseGTradeLiq(data);
            if (liq && liq.value > 0) handleLiquidation(liq);
          } catch {}
          return;
        }

        // All others: plain JSON
        const str = raw.toString();
        if (str === 'pong' || str === '{"event":"pong"}' || str === 'Pong') return;
        const data = JSON.parse(str);
        if (data.event === 'subscribe' || data.op === 'pong' || data.ret_msg === 'pong' || data.success !== undefined) return;
        if (data.id !== undefined && data.result !== undefined) return;
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
        if (liq && liq.value > 0) handleLiquidation(liq);
      } catch {}
    });

    ws.on('error', () => {
      connectionStatus[exchange] = false;
    });

    ws.on('close', () => {
      connectionStatus[exchange] = false;
      if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
      if (!destroyed) {
        console.log(`[WS] ${exchange} disconnected, reconnecting in ${RECONNECT_DELAY_MS}ms`);
        setTimeout(connect, RECONNECT_DELAY_MS);
      }
    });
  };

  connect();
  return { stop: () => { destroyed = true; } };
}

// ─── Start ─────────────────────────────────────────
console.log(`[INGESTER] Starting liquidation ingester for ${EXCHANGES.length} exchanges`);
console.log(`[INGESTER] Database: ${DATABASE_URL.replace(/:[^:@]+@/, ':***@')}`);

EXCHANGES.forEach(connectExchange);

// Health log
setInterval(() => {
  const connected = Object.entries(connectionStatus).filter(([, v]) => v).map(([k]) => k);
  console.log(`[HEALTH] Connected: ${connected.length}/${EXCHANGES.length} (${connected.join(', ')}) | Buffer: ${buffer.length} | Ingested: ${totalIngested} | Flushed: ${totalFlushed}`);
}, HEALTH_LOG_INTERVAL_MS);

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[INGESTER] SIGTERM received, flushing buffer...');
  await flushBuffer();
  await sql.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[INGESTER] SIGINT received, flushing buffer...');
  await flushBuffer();
  await sql.end();
  process.exit(0);
});
```

**Step 3: Create PM2 config**

Create `workers/ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'liq-ingester',
    script: 'workers/liquidation-ingester.ts',
    interpreter: 'npx',
    interpreter_args: 'tsx',
    env: {
      NODE_ENV: 'production',
      // DATABASE_URL loaded from .env or system env
    },
    max_memory_restart: '256M',
    restart_delay: 5000,
    max_restarts: 50,
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
  }],
};
```

**Step 4: Add worker script to package.json**

Add to `scripts`:
```json
"worker:liq": "npx tsx workers/liquidation-ingester.ts"
```

**Step 5: Verify the worker compiles**

Run: `npx tsx --check workers/liquidation-ingester.ts`
Expected: No TypeScript errors.

**Step 6: Commit**

```bash
git add workers/ package.json package-lock.json
git commit -m "feat: add PM2 liquidation WebSocket ingester worker"
```

---

## Task 4: Build Frontend — LiquidationFeedRow Component

**Files:**
- Create: `src/app/liquidations/components/LiquidationFeedRow.tsx`

**Step 1: Create the memoized feed row**

This is the smallest, most reusable component. Each row in the live feed.

```typescript
'use client';

import { memo } from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { TokenIconSimple } from '@/components/TokenIcon';
import { ExchangeLogo } from '@/components/ExchangeLogos';
import { formatLiqValue } from '@/lib/utils/format';

interface FeedRowProps {
  symbol: string;
  side: 'long' | 'short';
  value: number;
  price: number;
  quantity: number;
  exchange: string;
  timestamp: number;
  isNew?: boolean;
}

function getValueColor(value: number) {
  if (value >= 1_000_000) return 'text-purple-400';
  if (value >= 500_000) return 'text-red-400';
  if (value >= 100_000) return 'text-orange-400';
  return 'text-neutral-400';
}

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  return `${Math.floor(diff / 3600)}h`;
}

function LiquidationFeedRowInner({
  symbol, side, value, price, quantity, exchange, timestamp, isNew,
}: FeedRowProps) {
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors ${isNew ? 'animate-fade-in bg-hub-yellow/[0.04]' : ''}`}>
      {/* Side indicator */}
      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${side === 'long' ? 'bg-red-500' : 'bg-green-500'}`} />

      {/* Symbol */}
      <div className="flex items-center gap-1.5 w-16 flex-shrink-0">
        <TokenIconSimple symbol={symbol} size={14} />
        <span className="text-white text-xs font-medium truncate">{symbol}</span>
      </div>

      {/* Value — most important column */}
      <span className={`text-xs font-mono font-semibold w-16 text-right flex-shrink-0 ${getValueColor(value)}`}>
        {formatLiqValue(value)}
      </span>

      {/* Side label */}
      <span className={`text-[10px] font-medium w-8 flex-shrink-0 ${side === 'long' ? 'text-red-400' : 'text-green-400'}`}>
        {side === 'long' ? 'LONG' : 'SHRT'}
      </span>

      {/* Exchange */}
      <div className="flex items-center gap-1 w-14 flex-shrink-0">
        <ExchangeLogo exchange={exchange.toLowerCase()} size={12} />
        <span className="text-neutral-600 text-[10px] truncate">{exchange}</span>
      </div>

      {/* Time ago */}
      <span className="text-neutral-700 text-[10px] font-mono ml-auto flex-shrink-0">
        {timeAgo(timestamp)}
      </span>
    </div>
  );
}

export const LiquidationFeedRow = memo(LiquidationFeedRowInner);
```

**Step 2: Verify build**

Run: `npm run build`
Expected: Clean build.

**Step 3: Commit**

```bash
git add src/app/liquidations/components/LiquidationFeedRow.tsx
git commit -m "feat: add LiquidationFeedRow component"
```

---

## Task 5: Build Frontend — LiquidationFeed Panel

**Files:**
- Create: `src/app/liquidations/components/LiquidationFeed.tsx`

**Step 1: Create the feed panel**

```typescript
'use client';

import { useRef, useEffect } from 'react';
import { Zap } from 'lucide-react';
import { LiquidationFeedRow } from './LiquidationFeedRow';

interface LiqItem {
  symbol: string;
  exchange: string;
  side: 'long' | 'short';
  price: number;
  quantity: number;
  valueUsd: number;
  ts: number;
}

interface LiquidationFeedProps {
  data: LiqItem[];
  isLoading: boolean;
  sideFilter: 'all' | 'long' | 'short';
  onSideFilterChange: (f: 'all' | 'long' | 'short') => void;
}

export default function LiquidationFeed({
  data, isLoading, sideFilter, onSideFilterChange,
}: LiquidationFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);

  // Auto-scroll to top when new items arrive
  useEffect(() => {
    if (data.length > prevCountRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
    prevCountRef.current = data.length;
  }, [data.length]);

  const filtered = sideFilter === 'all'
    ? data
    : data.filter(d => d.side === sideFilter);

  return (
    <div className="flex flex-col h-full border border-white/[0.06] rounded-xl bg-[#0a0a0a] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06] bg-white/[0.02] flex-shrink-0">
        <div className="flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-hub-yellow" />
          <span className="text-xs font-semibold text-white">Live Feed</span>
          <span className="text-[10px] text-neutral-600 font-mono">{filtered.length}</span>
        </div>
        <div className="flex items-center gap-0.5">
          {(['all', 'long', 'short'] as const).map(f => (
            <button
              key={f}
              onClick={() => onSideFilterChange(f)}
              className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase transition-colors ${
                sideFilter === f
                  ? f === 'long' ? 'bg-red-500/20 text-red-400'
                    : f === 'short' ? 'bg-green-500/20 text-green-400'
                    : 'bg-white/[0.08] text-white'
                  : 'text-neutral-600 hover:text-neutral-400'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Feed list */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-5 h-5 border-2 border-hub-yellow/30 border-t-hub-yellow rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-neutral-600">
            <Zap className="w-8 h-8 mb-2 opacity-30" />
            <span className="text-xs">No liquidations in this timeframe</span>
          </div>
        ) : (
          filtered.map((liq, i) => (
            <LiquidationFeedRow
              key={`${liq.symbol}-${liq.exchange}-${liq.ts}-${i}`}
              symbol={liq.symbol}
              side={liq.side}
              value={liq.valueUsd}
              price={liq.price}
              quantity={liq.quantity}
              exchange={liq.exchange}
              timestamp={liq.ts}
              isNew={i < 3}
            />
          ))
        )}
      </div>
    </div>
  );
}
```

**Step 2: Verify build**

Run: `npm run build`

**Step 3: Commit**

```bash
git add src/app/liquidations/components/LiquidationFeed.tsx
git commit -m "feat: add LiquidationFeed panel component"
```

---

## Task 6: Build Frontend — LiquidationTreemap Panel

**Files:**
- Create: `src/app/liquidations/components/LiquidationTreemap.tsx`

**Step 1: Create the treemap**

A pure CSS/div-based treemap (no external library). Uses a simple squarified layout algorithm.

```typescript
'use client';

import { useMemo } from 'react';
import { Grid3X3 } from 'lucide-react';
import { TokenIconSimple } from '@/components/TokenIcon';
import { formatLiqValue } from '@/lib/utils/format';

interface TreemapItem {
  symbol: string;
  totalValue: number;
  longValue: number;
  shortValue: number;
  count: number;
}

interface LiquidationTreemapProps {
  data: TreemapItem[];
  isLoading: boolean;
  onSymbolClick?: (symbol: string) => void;
}

function getTreemapColor(longValue: number, shortValue: number): string {
  const isLongDominant = longValue > shortValue;
  const ratio = Math.max(longValue, shortValue) / (longValue + shortValue || 1);
  // Stronger dominance = more saturated
  if (isLongDominant) {
    return ratio > 0.7 ? 'bg-red-500/80 text-white' : 'bg-red-600/60 text-red-100';
  }
  return ratio > 0.7 ? 'bg-green-500/80 text-white' : 'bg-green-600/60 text-green-100';
}

// Simple treemap layout: first 3 items take full row, rest fill grid
export default function LiquidationTreemap({ data, isLoading, onSymbolClick }: LiquidationTreemapProps) {
  const top3 = data.slice(0, 3);
  const rest = data.slice(3, 20);
  const maxValue = data[0]?.totalValue || 1;

  return (
    <div className="border border-white/[0.06] rounded-xl bg-[#0a0a0a] overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.06] bg-white/[0.02]">
        <Grid3X3 className="w-3.5 h-3.5 text-hub-yellow" />
        <span className="text-xs font-semibold text-white">Heatmap</span>
        <span className="text-[10px] text-neutral-600 font-mono">{data.length} symbols</span>
      </div>

      {isLoading ? (
        <div className="h-[200px] flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-hub-yellow/30 border-t-hub-yellow rounded-full animate-spin" />
        </div>
      ) : data.length === 0 ? (
        <div className="h-[200px] flex items-center justify-center text-neutral-600 text-xs">
          No data yet
        </div>
      ) : (
        <div className="p-2">
          {/* Top 3 — large feature tiles */}
          <div className={`grid gap-1.5 mb-1.5 ${top3.length >= 3 ? 'grid-cols-3' : top3.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {top3.map(item => {
              const longPct = item.totalValue > 0 ? (item.longValue / item.totalValue) * 100 : 50;
              return (
                <button
                  key={item.symbol}
                  onClick={() => onSymbolClick?.(item.symbol)}
                  className={`${getTreemapColor(item.longValue, item.shortValue)} h-24 rounded-lg p-2.5 flex flex-col justify-between transition-all hover:brightness-110 text-left`}
                >
                  <div className="flex items-center gap-1.5">
                    <TokenIconSimple symbol={item.symbol} size={16} />
                    <span className="font-bold text-xs">{item.symbol}</span>
                    <span className="opacity-60 text-[10px] ml-auto">{item.count}</span>
                  </div>
                  <div>
                    <div className="font-bold text-sm font-mono">{formatLiqValue(item.totalValue)}</div>
                    <div className="flex h-1 rounded-full overflow-hidden bg-black/30 mt-1">
                      <div className="bg-red-400 h-full" style={{ width: `${longPct}%` }} />
                      <div className="bg-green-400 h-full" style={{ width: `${100 - longPct}%` }} />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Rest — compact grid */}
          {rest.length > 0 && (
            <div className="grid grid-cols-4 lg:grid-cols-5 gap-1">
              {rest.map(item => (
                <button
                  key={item.symbol}
                  onClick={() => onSymbolClick?.(item.symbol)}
                  className={`${getTreemapColor(item.longValue, item.shortValue)} h-14 rounded-md p-1.5 flex flex-col justify-between transition-all hover:brightness-110 text-left`}
                >
                  <div className="flex items-center gap-1">
                    <span className="font-semibold text-[10px]">{item.symbol}</span>
                    <span className="opacity-50 text-[9px] ml-auto">{item.count}</span>
                  </div>
                  <span className="font-semibold text-[10px] font-mono">{formatLiqValue(item.totalValue)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Verify build + Commit**

```bash
npm run build
git add src/app/liquidations/components/LiquidationTreemap.tsx
git commit -m "feat: add LiquidationTreemap panel component"
```

---

## Task 7: Build Frontend — LiquidationChart Panel

**Files:**
- Create: `src/app/liquidations/components/LiquidationChart.tsx`
- Delete: `src/app/liquidations/components/LiquidationHistoryChart.tsx`

**Step 1: Create the new chart component**

Dynamically imports recharts. Fetches data from DB API. Supports symbol selection and adapts bucket size to timeframe.

The chart should be similar to the existing `LiquidationHistoryChart` but enhanced:
- Receives `timeframeHours` prop to adapt bucket size
- Symbol selector: BTC / ETH / SOL / ALL
- Uses `useSWR` for data fetching instead of manual `useEffect`
- Uses existing InfoHub custom tooltip style

Structure: Mostly reuse the existing chart code from `LiquidationHistoryChart.tsx` but:
- Add `timeframeHours` prop
- Add 'ALL' option to symbol selector
- Use `useSWR` instead of `useState` + `useEffect` + `fetch`
- Adapt time display format based on timeframe

**Step 2: Remove old chart**

Delete `src/app/liquidations/components/LiquidationHistoryChart.tsx`

**Step 3: Verify build + Commit**

```bash
npm run build
git add -A src/app/liquidations/components/
git commit -m "feat: add LiquidationChart, remove old LiquidationHistoryChart"
```

---

## Task 8: Build Frontend — Top Bar + Bottom Bar

**Files:**
- Create: `src/app/liquidations/components/LiquidationTopBar.tsx`
- Create: `src/app/liquidations/components/LiquidationBottomBar.tsx`

**Step 1: Create top bar**

Compact horizontal bar with: title, stats, timeframe selector, sound toggle.

Stats (total value, count, long/short split) are computed from the feed data passed as props.

**Step 2: Create bottom bar**

Thin bar with long/short ratio gradient + exchange filter chips.

Exchange filter as compact chips: All | CEX | DEX with individual exchange toggles.

**Step 3: Verify build + Commit**

```bash
npm run build
git add src/app/liquidations/components/LiquidationTopBar.tsx src/app/liquidations/components/LiquidationBottomBar.tsx
git commit -m "feat: add LiquidationTopBar and LiquidationBottomBar"
```

---

## Task 9: Rewrite page.tsx — Multi-Panel Layout

**Files:**
- Rewrite: `src/app/liquidations/page.tsx`

**Step 1: Rewrite the page**

The new page is a CSS Grid layout with:
- Full viewport height (`h-screen` minus header)
- 3 SWR data hooks (feed, treemap, chart)
- Grid: top bar → [left col: treemap + chart | right col: feed] → bottom bar
- All state: timeframe, sideFilter, exchangeFilter, selectedSymbol

Key structure:

```tsx
'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import Header from '@/components/Header';
import LiquidationTopBar from './components/LiquidationTopBar';
import LiquidationTreemap from './components/LiquidationTreemap';
import LiquidationFeed from './components/LiquidationFeed';
import LiquidationBottomBar from './components/LiquidationBottomBar';
import dynamic from 'next/dynamic';

const LiquidationChart = dynamic(
  () => import('./components/LiquidationChart'),
  { ssr: false, loading: () => <div className="h-[200px] bg-[#0a0a0a] rounded-xl animate-pulse" /> }
);

const TIMEFRAME_HOURS: Record<string, number> = { '1h': 1, '4h': 4, '12h': 12, '24h': 24 };
const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function LiquidationsPage() {
  const [timeframe, setTimeframe] = useState<'1h' | '4h' | '12h' | '24h'>('1h');
  const [sideFilter, setSideFilter] = useState<'all' | 'long' | 'short'>('all');
  const [exchangeFilter, setExchangeFilter] = useState<string>('all');
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(false);

  const hours = TIMEFRAME_HOURS[timeframe];

  // Feed data (polls every 5s)
  const feedKey = `/api/history/liquidations?mode=feed&hours=${hours}&limit=200`;
  const { data: feedData, isLoading: feedLoading } = useSWR(feedKey, fetcher, { refreshInterval: 5000 });

  // Treemap data (polls every 10s)
  const treemapKey = `/api/history/liquidations?mode=treemap&hours=${hours}`;
  const { data: treemapData, isLoading: treemapLoading } = useSWR(treemapKey, fetcher, { refreshInterval: 10000 });

  const feedItems = feedData?.data || [];
  const treemapItems = treemapData?.data || [];

  // Compute stats from feed
  const stats = useMemo(() => {
    let longValue = 0, shortValue = 0, count = 0;
    for (const item of feedItems) {
      if (item.side === 'long') longValue += item.valueUsd;
      else shortValue += item.valueUsd;
      count++;
    }
    return { longValue, shortValue, total: longValue + shortValue, count };
  }, [feedItems]);

  return (
    <div className="h-screen flex flex-col bg-hub-black overflow-hidden">
      <Header />
      <LiquidationTopBar
        stats={stats}
        timeframe={timeframe}
        onTimeframeChange={setTimeframe}
        soundEnabled={soundEnabled}
        onSoundToggle={() => setSoundEnabled(s => !s)}
      />

      {/* Main content grid */}
      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[55%_45%] gap-2 px-3 py-2">
        {/* Left column */}
        <div className="flex flex-col gap-2 min-h-0">
          <div className="flex-1 min-h-0 overflow-hidden">
            <LiquidationTreemap
              data={treemapItems}
              isLoading={treemapLoading}
              onSymbolClick={setSelectedSymbol}
            />
          </div>
          <div className="flex-1 min-h-0">
            <LiquidationChart timeframeHours={hours} symbol={selectedSymbol} />
          </div>
        </div>

        {/* Right column — feed */}
        <div className="min-h-0">
          <LiquidationFeed
            data={feedItems}
            isLoading={feedLoading}
            sideFilter={sideFilter}
            onSideFilterChange={setSideFilter}
          />
        </div>
      </div>

      <LiquidationBottomBar
        stats={stats}
        exchangeFilter={exchangeFilter}
        onExchangeFilterChange={setExchangeFilter}
      />
    </div>
  );
}
```

**Step 2: Verify build + manual test**

Run: `npm run build`
Run: `npm run dev` → navigate to `/liquidations` → verify layout renders.

**Step 3: Commit**

```bash
git add src/app/liquidations/page.tsx
git commit -m "feat: rewrite liquidations page as multi-panel trading terminal"
```

---

## Task 10: Polish + Mobile Responsive + Testing

**Files:**
- Modify: Various component files for responsive breakpoints
- Modify: `src/app/liquidations/page.tsx` — mobile layout adjustments

**Step 1: Mobile responsive layout**

Below `md` breakpoint:
- Grid changes from `grid-cols-[55%_45%]` to `grid-cols-1`
- Page becomes scrollable (remove `overflow-hidden` on mobile)
- Treemap → Chart → Feed stacked vertically
- Top bar wraps to two lines
- Feed gets a max-height on mobile

**Step 2: Visual polish**

- Verify gold accent colors match InfoHub brand
- Test light theme compatibility (if applicable)
- Ensure all animations work (fade-in on new feed rows)
- Check font sizes are legible at all breakpoints

**Step 3: Run full test suite**

Run: `npm run build` — must pass clean
Run: `npm run test:unit` — must pass
Run: `npm run dev` → manual test at `/liquidations`

**Step 4: Final commit**

```bash
git add -A
git commit -m "polish: responsive layout and visual refinements for liquidations"
```

---

## Execution Order Summary

| # | Task | Dependencies | Est. Time |
|---|------|-------------|-----------|
| 1 | Extract parsers to shared module | — | 20 min |
| 2 | Add DB functions + API modes | — | 30 min |
| 3 | Create PM2 worker | Task 1 | 45 min |
| 4 | LiquidationFeedRow component | — | 15 min |
| 5 | LiquidationFeed panel | Task 4 | 20 min |
| 6 | LiquidationTreemap panel | — | 25 min |
| 7 | LiquidationChart panel | — | 25 min |
| 8 | TopBar + BottomBar | — | 20 min |
| 9 | Rewrite page.tsx | Tasks 2, 5-8 | 30 min |
| 10 | Polish + responsive + test | Task 9 | 30 min |

**Tasks 1-2 and 4-8 can be parallelized.** Task 3 depends on 1. Task 9 depends on 2 + all component tasks. Task 10 is final polish.

**Total estimated: ~4.5 hours**
