# Execution Cost Analytics — Design Document

**Date**: 2026-02-28
**Status**: Approved
**Route**: `/execution-costs`

## Overview

New InfoHub page that compares real-time execution costs across all 11 DEX perpetual exchanges. For a given asset, order size, and direction, it ranks venues by total cost (fees + spread + slippage/price impact) — similar to LiquidView but integrated into InfoHub.

## Requirements

- **Scope**: New page within InfoHub at `/execution-costs`
- **Venues**: All 11 DEX perps (Hyperliquid, dYdX, Drift, Aster, Aevo, Lighter, Extended, edgeX, gTrade, GMX, Variational)
- **Assets**: Crypto only. Top ~50 by OI, shown where 2+ venues list the pair
- **Order sizes**: Preset buttons ($10K, $50K, $100K, $500K, $1M) + custom input
- **Direction**: Long / Short toggle (affects slippage direction and AMM skew)
- **Data**: Real-time with 10s server-side cache. No historical storage for MVP
- **Method**: Full simulation — CLOB book walking, AMM formulas, RPC calls

## Page Layout

```
┌──────────────────────────────────────────────────────────┐
│  InfoHub > Execution Costs                               │
│                                                          │
│  Asset: [BTC ▼]    Direction: [Long | Short]             │
│  Order Size: [$10K] [$50K] [$100K] [$500K] [$1M] [____] │
│                                                          │
│  ┌─ Execution Landscape ────────────────────────────┐    │
│  │  Ranked cards, best → worst total cost:          │    │
│  │                                                  │    │
│  │  🥇 Venue A       🥈 Venue B       🥉 Venue C   │    │
│  │  Total: 0.08%     Total: 0.12%     Total: 0.15% │    │
│  │  Fee: 0.05%       Fee: 0.035%      Fee: 0.05%   │    │
│  │  Spread: 0.02%    Spread: 0.04%    Spread: 0.06%│    │
│  │  Impact: 0.01%    Impact: 0.045%   Impact: 0.04%│    │
│  │  [Trade Now ↗]    [Trade Now ↗]    [Trade Now ↗] │    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
│  ┌─ Cost Breakdown Table ───────────────────────────┐    │
│  │  Exchange  │ Fee %  │ Spread % │ Impact % │ Total│    │
│  │  Sortable columns, all venues                    │    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
│  ┌─ Depth Visualization ────────────────────────────┐    │
│  │  Stacked area chart: cumulative depth by venue   │    │
│  │  X-axis: % from mid price                        │    │
│  │  Y-axis: cumulative $ depth                      │    │
│  │  Vertical line at user's order size              │    │
│  └──────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────┘
```

### UX Details

- **Ranked cards**: Top 3 venues highlighted with medal icons. Remaining venues shown in smaller cards below
- **Direction toggle**: Long/Short — affects which side of the book we walk and AMM skew direction
- **"Trade Now" links**: Deep-link to each DEX's trading page for the selected pair (reuse `TRADE_URLS` from constants)
- **Cost breakdown table**: Sortable by any column. Shows method type (CLOB/AMM/Quote)
- **Depth chart**: Recharts area chart overlaying cumulative depth curves per venue. Vertical marker at user's order size

## API Design

### Endpoint

```
GET /api/execution-costs?asset=BTC&size=100000&direction=long
```

### Response Shape

```typescript
interface ExecutionCostResponse {
  asset: string;
  size: number;
  direction: 'long' | 'short';
  timestamp: number;
  venues: VenueCost[];
}

interface VenueCost {
  exchange: string;
  available: boolean;       // false if pair not listed or API failed
  fee: number;              // % (from EXCHANGE_FEES constants)
  spread: number;           // % (half-spread from mid)
  priceImpact: number;      // % (slippage from walking book or formula)
  totalCost: number;        // fee + spread + priceImpact
  executionPrice: number;   // estimated fill price
  midPrice: number;         // reference mid price
  maxFillableSize: number;  // max $ fillable within reasonable slippage
  depthLevels?: number;     // how many book levels available (CLOB only)
  method: 'clob' | 'amm_formula' | 'amm_rpc' | 'quote';
  error?: string;           // error message if available=false
}
```

### Caching

- 10-second L1 Map cache keyed by `${asset}:${direction}` (size-independent — we cache the raw book/params, compute costs per-size on the fly)
- If a venue API fails, return `available: false` — don't block other venues

## Venue Integration Strategies

### Strategy 1: CLOB Book Walker (5 venues)

**Venues**: Hyperliquid, dYdX, Drift, Aster, Aevo

All have REST orderbook endpoints returning L2 (aggregated price levels):

| Venue | Endpoint | Levels |
|-------|----------|--------|
| Hyperliquid | `POST /info` body `{type: "l2Book", coin: "BTC"}` | 20 per side |
| dYdX | `GET /v4/orderbooks/perpetualMarket/BTC-USD` | Full book |
| Drift | `GET /l2?marketName=BTC-PERP&depth=50&includeVamm=true` | 50 per side |
| Aster | `GET /fapi/v1/depth?symbol=BTCUSDT&limit=1000` | Up to 1000 |
| Aevo | `GET /orderbook?asset=BTC` | Full book |

**Algorithm** — Walk the book:

```typescript
function walkBook(
  levels: { price: number; size: number }[],
  orderSizeUsd: number,
  midPrice: number
): { vwap: number; filled: number; levelsConsumed: number } {
  let remaining = orderSizeUsd;
  let weightedSum = 0;
  let levelsConsumed = 0;

  for (const level of levels) {
    const levelValueUsd = level.size * level.price;
    const fillUsd = Math.min(remaining, levelValueUsd);
    weightedSum += fillUsd * level.price;
    remaining -= fillUsd;
    levelsConsumed++;
    if (remaining <= 0) break;
  }

  const filledUsd = orderSizeUsd - remaining;
  const vwap = filledUsd > 0 ? weightedSum / filledUsd : midPrice;
  return { vwap, filled: filledUsd, levelsConsumed };
}

// spread% = |vwap - midPrice| / midPrice * 100
// totalCost% = spread% + fee%
```

No auth required for any of these.

### Strategy 2: L3/WebSocket Book (3 venues)

**Venues**: Lighter, Extended, edgeX

| Venue | Method | Notes |
|-------|--------|-------|
| Lighter | REST L3: `GET /orderBookOrders?market_id=X&limit=250` | Individual orders, aggregate to L2 ourselves |
| Extended | WebSocket snapshot from `wss://api.starknet.extended.exchange` | Short-lived WS, grab snapshot, disconnect |
| edgeX | REST or WS: 200-level depth via `depth.{contractId}.200` | Labeled beta |

Same book-walking algorithm after aggregation to price levels.

### Strategy 3: AMM Formula (2 venues)

**gTrade** — Synthetic oracle AMM:

```typescript
// Formula from gTrade docs:
// dynamicSpread% = (existingOI + newSize/2) / depth1pct
// where depth1pct = pairDepths[pairIndex] (USD value causing 1% move)

const depth = tradingVariables.pairDepths[pairIndex];
const direction_depth = direction === 'long' ? depth.onePercentDepthAboveUsd : depth.onePercentDepthBelowUsd;
const currentOI = direction === 'long'
  ? tradingVariables.pairOis[pairIndex].longOiUsd
  : tradingVariables.pairOis[pairIndex].shortOiUsd;
const priceImpact = (currentOI + orderSize / 2) / direction_depth;
// Total = priceImpact + 0.05% taker fee (open) + 0.05% (close, if round-trip)
```

Data from: `GET https://backend-arbitrum.gains.trade/trading-variables`

**GMX V2** — Pool-based AMM with on-chain price impact:

```typescript
// eth_call to Reader.getExecutionPrice() on Arbitrum
// Requires: Arbitrum RPC endpoint (public or Alchemy/Infura)
// Reader contract address: from GMX V2 contracts
// Parameters: marketKey, prices struct, sizeDeltaUsd (1e30), isLong
// Returns: priceImpactUsd (1e30), executionPrice

const rpcResult = await fetch(ARBITRUM_RPC, {
  method: 'POST',
  body: JSON.stringify({
    jsonrpc: '2.0',
    method: 'eth_call',
    params: [{ to: READER_ADDRESS, data: encodedCallData }, 'latest']
  })
});
const priceImpact = Number(BigInt(result.priceImpactUsd)) / 1e30;
```

### Strategy 4: Quote-Based (1 venue)

**Variational** — Provides bid/ask at 3 fixed sizes:

```typescript
// GET /metadata/stats returns bid/ask at $1K, $100K, $1M
// Linear interpolation between nearest brackets
// e.g. for $50K: interpolate between $1K and $100K quotes
const spread = (askPrice - bidPrice) / midPrice * 100;
```

## Symbol Mapping

Reuse existing normalization from funding/OI fetchers. Each venue fetcher maps normalized asset names (BTC, ETH, SOL) to venue-native format. Asset dropdown shows intersection of assets listed on 2+ venues.

| Asset | Hyperliquid | dYdX | gTrade | GMX | Drift | Aster | Aevo | Lighter | Extended | edgeX | Variational |
|-------|------------|------|--------|-----|-------|-------|------|---------|----------|-------|-------------|
| BTC | `BTC` | `BTC-USD` | pairIndex | `BTC/USD [...]` | `BTC-PERP` | `BTCUSDT` | `BTC` | market_id | symbol | contract_id | symbol |

## Error Handling

- Each venue fetches independently with `fetchWithTimeout` (5s timeout)
- If a venue API fails: `available: false, error: "timeout"` / `"not listed"` / `"api error"`
- If fewer than 2 venues return data: show error banner "Not enough data for comparison"
- Rate limit handling: respect per-venue limits, fail gracefully

## File Structure

```
src/app/execution-costs/
  page.tsx                          # Main page component
  components/
    VenueCard.tsx                   # Ranked venue card
    CostBreakdownTable.tsx          # Sortable table
    DepthChart.tsx                  # Recharts area chart
    AssetSelector.tsx               # Asset dropdown
    SizeSelector.tsx                # Preset buttons + custom input
    DirectionToggle.tsx             # Long/Short toggle

src/app/api/execution-costs/
  route.ts                          # Main API endpoint

src/lib/execution-costs/
  types.ts                          # ExecutionCostResponse, VenueCost types
  book-walker.ts                    # CLOB book walking algorithm
  symbol-map.ts                     # Asset → venue-native symbol mapping
  venues/
    hyperliquid.ts                  # Fetch + parse L2 book
    dydx.ts                         # Fetch + parse orderbook
    drift.ts                        # Fetch + parse L2 (with vAMM)
    aster.ts                        # Fetch + parse depth
    aevo.ts                         # Fetch + parse orderbook
    lighter.ts                      # Fetch L3 → aggregate to L2
    extended.ts                     # WebSocket snapshot
    edgex.ts                        # Fetch depth
    gtrade.ts                       # Formula from trading-variables
    gmx.ts                          # RPC call to Reader contract
    variational.ts                  # Quote interpolation
    index.ts                        # Export all venue fetchers
```

## Dependencies

- **No new npm packages** — reuse existing fetch utilities, Recharts, Tailwind
- **Arbitrum RPC** for GMX — use public RPC or add Alchemy/Infura key to env
- **All venue APIs** are free, no auth required for market data

## Future Enhancements (v2)

- Historical execution cost snapshots via cron (DB storage)
- "Best venue over time" trends chart
- Non-crypto assets (stocks, forex, commodities via gTrade)
- WebSocket streaming for live cost updates
- CEX vs DEX comparison mode
