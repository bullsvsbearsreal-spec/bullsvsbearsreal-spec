# Liquidation Page Redesign + Real-Time DB Storage

## Overview
- **Goal**: Full redesign of the liquidations page into a multi-panel trading terminal, backed by real-time database storage via a standalone WebSocket worker
- **Style**: Dark, dense, Bloomberg-terminal energy — all panels visible simultaneously
- **Data flow**: PM2 worker → PostgreSQL → Next.js API → Frontend (SWR polling)

---

## Architecture

### Data Pipeline

```
PM2 Worker (24/7 on VPS)
  ├── Binance WS (all forceOrders)
  ├── Bybit WS (top 25 symbols)
  ├── OKX WS (all SWAP liquidations)
  ├── Bitget WS (all USDT-FUTURES)
  ├── Deribit WS (BTC+ETH perpetuals)
  ├── MEXC WS (all liquidation orders)
  ├── BingX WS (top 5 symbols)
  ├── HTX WS (top 20 symbols)
  └── gTrade WS (all trade closures)
        │
        ▼
  In-memory buffer (flush every 2s)
        │
        ▼
  PostgreSQL: liquidation_snapshots
  (ON CONFLICT DO NOTHING dedup)
        │
        ▼
  Next.js API: /api/history/liquidations
  (SWR polling every 5s from frontend)
```

### Worker Details

- **Location**: `workers/liquidation-ingester.ts` (repo root)
- **Runtime**: Node.js with tsx or ts-node
- **Process manager**: PM2 with `ecosystem.config.js`
- **Connection**: Direct to PostgreSQL via `DATABASE_URL`
- **Parsers**: Extracted to shared `src/lib/liquidation-parsers.ts`
- **Batching**: Buffer events in memory, flush INSERT every 2 seconds
- **Reconnection**: Auto-reconnect with 3s delay per exchange
- **Logging**: Structured stdout (PM2 captures to log files)
- **Health**: Periodic health check log (connections, events/min, DB write rate)

### Database Changes

**No schema changes needed.** The existing `liquidation_snapshots` table already supports all fields:

```sql
-- Existing table (no changes)
CREATE TABLE IF NOT EXISTS liquidation_snapshots (
  id SERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  exchange TEXT NOT NULL,
  side TEXT NOT NULL,
  price REAL NOT NULL,
  quantity REAL NOT NULL,
  value_usd REAL NOT NULL,
  ts TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Existing indexes handle dedup + queries
```

**Changes to existing DB functions:**
- `getAllRecentLiquidations()` — increase default limit from 500 to 1000 for longer timeframes
- Add new function: `getLiquidationFeed(hours, limit, exchange?, side?)` with filtering support
- Add new function: `getLiquidationTreemap(hours)` — grouped by symbol with long/short breakdown
- Retention: Keep 14 days (existing)

### API Changes

**Enhanced `GET /api/history/liquidations`:**
- New mode: `mode=treemap&hours=1` — returns aggregated data for treemap visualization
- Enhanced `mode=feed` — add `exchange` and `side` query params for filtering
- Reduce cache to `s-maxage=5` for near-real-time polling

---

## Frontend Design

### Layout Structure

Full-viewport, no page scroll. CSS Grid with fixed regions.

```
┌──────────────────────────────────────────────────────┐
│ TOP BAR (48px fixed)                                  │
│ Title · Stats · Timeframe · Controls                  │
├───────────────────────────┬──────────────────────────┤
│ LEFT COLUMN (55%)         │ RIGHT COLUMN (45%)        │
│                           │                           │
│ ┌─ HEATMAP TREEMAP ─────┐│ ┌─ LIVE FEED ───────────┐│
│ │ Sized rectangles       ││ │ Scrollable list        ││
│ │ Color = long/short     ││ │ ~36px compact rows     ││
│ │ Top 20 symbols         ││ │ Auto-scroll on new     ││
│ └────────────────────────┘│ │ Side/Exchange filters  ││
│                           │ │                         ││
│ ┌─ HISTORY CHART ────────┐│ │ Symbol · Value · Exch  ││
│ │ Stacked bar chart      ││ │ Side dot · Timestamp   ││
│ │ Long (red) / Short (grn)│ │                         ││
│ │ Time buckets from DB   ││ │                         ││
│ │ Symbol: BTC/ETH/SOL/ALL││ └─────────────────────────┘│
│ └────────────────────────┘│                           │
├───────────────────────────┴──────────────────────────┤
│ BOTTOM BAR (32px fixed)                               │
│ Long/Short ratio gradient bar · Exchange chips         │
└──────────────────────────────────────────────────────┘
```

### Top Bar
- **Left**: "Liquidations" title + connection indicator (e.g., "DB Connected" with green dot)
- **Center**: Inline stats — `$4.2M total · 312 liqs · L 58% / S 42%`
- **Right**: Timeframe pills `[1h] [4h] [12h] [24h]` + sound toggle

### Left Column — Panel A: Heatmap Treemap
- Treemap visualization where each rectangle = one symbol
- **Size** proportional to total liquidation volume
- **Color**: Red gradient = long-dominant, Green gradient = short-dominant
- Hover shows: symbol, total value, long/short split, top exchange
- Click filters the live feed to that symbol
- Data: `GET /api/history/liquidations?mode=treemap&hours={timeframe}`
- SWR polling every 10 seconds

### Left Column — Panel B: History Chart
- Stacked bar chart: red (long) + green (short) per time bucket
- Bucket size adapts to timeframe: 5min for 1h, 15min for 4h, 1h for 12h/24h
- Symbol selector tabs: BTC / ETH / SOL / ALL
- Data: `GET /api/history/liquidations?symbol={sym}&days={n}`
- Dynamically imported (code-split recharts)

### Right Column — Panel C: Live Feed
- Full height of content area, internally scrollable
- Each row (~36px): colored side dot, token icon, symbol name, value (color-coded by size), exchange logo, relative timestamp
- New items prepend with brief gold flash animation
- Top: mini filter bar — All/Long/Short toggle + exchange dropdown
- Data: SWR polling `GET /api/history/liquidations?mode=feed&hours={timeframe}&limit=200` every 5 seconds
- Optional enhancement: keep client-side WS for sub-second updates, merge with DB data

### Bottom Bar
- Thin long/short ratio bar (red ← → green gradient)
- Exchange filter chips: All / CEX / DEX / individual exchange toggles (compact)

### Mobile Responsive
- Below `md` breakpoint: stack left/right into single column
- Treemap on top, chart below, feed below that (scrollable page on mobile)
- Top bar wraps stats to second line

---

## Component Structure

```
src/app/liquidations/
  page.tsx                    — Main page (layout grid, data fetching, state)
  components/
    LiquidationTopBar.tsx     — Stats, timeframe, controls
    LiquidationTreemap.tsx    — Treemap heatmap visualization
    LiquidationChart.tsx      — History bar chart (replaces LiquidationHistoryChart)
    LiquidationFeed.tsx       — Live feed list
    LiquidationBottomBar.tsx  — Ratio bar + exchange filters
    LiquidationFeedRow.tsx    — Individual feed row (memoized)
```

### Data Flow (Frontend)

```
page.tsx
  ├── timeframe state (1h/4h/12h/24h)
  ├── exchangeFilter state
  ├── sideFilter state
  │
  ├── useSWR('/api/history/liquidations?mode=feed&hours=X&limit=200')
  │     → feeds LiquidationFeed + LiquidationTopBar stats
  │
  ├── useSWR('/api/history/liquidations?mode=treemap&hours=X')
  │     → feeds LiquidationTreemap
  │
  └── useSWR('/api/history/liquidations?symbol=X&days=Y')
        → feeds LiquidationChart
```

All data comes from the DB via API. No more client-side WebSocket hook on this page. No more localStorage persistence. The PM2 worker handles all data collection server-side.

---

## Files to Create
- `workers/liquidation-ingester.ts` — Standalone WS→DB ingester
- `workers/ecosystem.config.js` — PM2 configuration
- `src/lib/liquidation-parsers.ts` — Shared parser functions
- `src/app/liquidations/components/LiquidationTopBar.tsx`
- `src/app/liquidations/components/LiquidationTreemap.tsx`
- `src/app/liquidations/components/LiquidationChart.tsx`
- `src/app/liquidations/components/LiquidationFeed.tsx`
- `src/app/liquidations/components/LiquidationBottomBar.tsx`
- `src/app/liquidations/components/LiquidationFeedRow.tsx`

## Files to Modify
- `src/app/liquidations/page.tsx` — Complete rewrite (new layout)
- `src/app/api/history/liquidations/route.ts` — Add treemap mode, filtering
- `src/lib/db/index.ts` — Add `getLiquidationTreemap()`, enhance `getAllRecentLiquidations()`
- `src/hooks/useMultiExchangeLiquidations.ts` — Keep for other pages that use it, but liquidations page no longer imports it

## Files to Delete
- `src/app/liquidations/components/LiquidationHistoryChart.tsx` — Replaced by new LiquidationChart

---

## Estimated Effort
- Worker + parsers extraction: ~2 hours
- DB functions + API changes: ~1 hour
- Frontend redesign (all panels): ~4 hours
- Testing + polish: ~1 hour
- **Total: ~8 hours**
