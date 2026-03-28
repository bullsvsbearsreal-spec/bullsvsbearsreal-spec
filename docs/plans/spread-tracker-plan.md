# Spread Tracker — Implementation Plan

## Overview
TradingView-style multi-line chart showing per-exchange price spreads over time.
Two views: compact section on `/spreads` + dedicated full-page `/spread-tracker`.

## Phase 1: Backend — Price History API & Cron Fix

### 1.1 Fix mark_price DB population
- The `funding_snapshots` table has a `mark_price` column but it's returning empty
- Debug why `getPriceHistoryMulti()` returns `exchanges: {}` even though cron passes `markPrice`
- Verify the cron job at `/api/cron/snapshot` is actually inserting non-null mark_price values
- Add logging to trace the issue

### 1.2 Enhance price-multi API
- Add symbol validation
- Support `exchanges` query param to filter specific exchanges
- Add `interval` param for bucketing (1min, 5min, 10min, 1h based on time range)
- Return exchange metadata (color assignments, display names)
- Add spread stats in response (current, avg, max, min with timestamps)

### 1.3 New cron: dedicated price snapshots (optional)
- If mark_price from funding_snapshots is insufficient (10-min granularity)
- Create `price_snapshots` table with 1-5 min granularity
- Cron fetches from `/api/tickers` and stores per-symbol per-exchange prices
- Retention: 90 days

## Phase 2: Frontend — Chart Component

### 2.1 SpreadTrackerChart component (Recharts ComposedChart)
- **Multi-line**: One colored line per exchange showing their price over time
- **Right-side labels**: TradingView-style sorted labels with exchange name + current value + % change
  - Colored background matching line color
  - Sorted by current price (highest to lowest)
  - Update in real-time on data refresh
- **Shaded spread band**: Area between highest and lowest exchange prices
- **Crosshair tooltip**: On hover, vertical line showing all exchange prices at that timestamp
- **Dark theme**: Match InfoHub's dark UI (#0a0a0a background)

### 2.2 Controls
- **Symbol selector**: Searchable dropdown, 1000+ symbols, majors first
- **Exchange selector**:
  - "Compare 2" mode: Pick exactly 2 exchanges, show spread between them
  - "Multi" mode: Pick any number, show all their price lines
  - Default: Binance + Bybit + OKX + Hyperliquid + Bitget
- **Time range tabs**: 1H | 4H | 1D | 7D | 30D | 90D
- **Y-axis toggle**: $ (dollar spread) | % (percentage) | bps (basis points)
- **Fullscreen button**: Expand chart to full viewport

### 2.3 Stats Panel (below chart)
- Current spread: $XX / XX bps
- Average spread (for selected period)
- Max spread + timestamp
- Min spread + timestamp
- Number of data points
- Exchange count

## Phase 3: Pages

### 3.1 Compact view on /spreads
- Replace current "Price Spread" section with a compact SpreadTrackerChart
- Height: 400px, limited controls (symbol + time range + exchange pills)
- "Open full view →" link to /spread-tracker

### 3.2 Dedicated /spread-tracker page
- Full-height chart (70vh)
- All controls visible
- Stats panel below
- URL state: `?symbol=BTC&exchanges=Binance,Bybit&range=7D&unit=bps` (shareable)
- Keyboard shortcuts: 1-6 for time ranges, / for symbol search

## Phase 4: Multi-Symbol Mode (like TradingView reference)

### 4.1 Symbol performance overlay
- Toggle between "Exchange Spread" mode and "Symbol Performance" mode
- Symbol mode: Each line = different coin's % change from start of period
- Default: BTC, ETH, SOL, XRP, DOGE, LINK, AVAX, ADA + user-selected
- Right-side labels: Symbol name + current % change, sorted by performance
- Colors: Distinct per symbol (amber, purple, green, red, cyan, pink, orange, teal...)

## Technical Notes
- Use Recharts ComposedChart with Line + Area + ReferenceLine
- 10-min timestamp bucketing with forward-fill for missing data
- Custom right-axis renderer for TradingView-style labels
- Responsive: stack controls on mobile, reduce label font size
- Data source: `/api/history/price-multi` endpoint
- Cache: 2-min SWR with stale-while-revalidate
