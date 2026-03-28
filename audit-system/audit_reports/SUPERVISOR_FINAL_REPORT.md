# InfoHub Dashboard — 18-Agent Consolidated Audit Report

**Date**: 2026-03-17
**Supervisor**: Claude Code Agent Teams (18 agents)
**Pages Audited**: 17/17
**Total Agent Runtime**: ~30 minutes (parallel execution)

---

## EXECUTIVE SUMMARY

**Overall Dashboard Score: 6.3/10**

The InfoHub crypto dashboard has a **strong architectural foundation** with impressive exchange coverage (30+ exchanges, best-in-class for DEX). The Funding Rates page is a genuine market leader. However, the dashboard is held back by: (1) broken/stale integrations from March 2026 API changes (GMX, gTrade), (2) data source gaps from Binance's liquidation endpoint deprecation, (3) inconsistent code patterns (some pages use SWR, others raw setInterval), (4) accessibility failures (red-green color scales), and (5) several pages where the backend is more capable than the frontend exposes.

---

## SCOREBOARD

| # | Page | Category | UI/UX | Data | RT | Bugs | Overall |
|---|------|----------|-------|------|----|------|---------|
| 1 | Chart | ANALYSIS | 7.5 | 8.0 | 8.0 | 6.0 | **7.4** |
| 2 | Screener | ANALYSIS | 7.0 | 8.0 | 5.0 | 6.0 | **6.5** |
| 3 | Options | ANALYSIS | 8.0 | 7.0 | 6.0 | 5.0 | **6.5** |
| 4 | Basis | ANALYSIS | 7.0 | 5.0 | 7.0 | 7.0 | **6.5** |
| 5 | Predictions | ANALYSIS | 7.0 | 8.0 | 7.0 | 7.0 | **7.3** |
| 6 | Execution Costs | ANALYSIS | 7.0 | 5.0 | 7.0 | 7.0 | **6.5** |
| 7 | **Funding Rates** | **FUNDING & OI** | **8.0** | **7.0** | **8.0** | **7.0** | **7.5** |
| 8 | Funding Heatmap | FUNDING & OI | 5.0 | 6.0 | 7.0 | 7.0 | **6.3** |
| 9 | Open Interest | FUNDING & OI | 6.0 | 7.0 | 7.0 | 7.0 | **6.8** |
| 10 | OI Heatmap | FUNDING & OI | 7.0 | 8.0 | 7.0 | 7.0 | **7.3** |
| 11 | **Liquidations** | **LIQUIDATIONS** | **6.0** | **3.0** | **5.0** | **4.0** | **4.5** |
| 12 | **Liq Map** | **LIQUIDATIONS** | **6.0** | **3.0** | **6.0** | **6.0** | **5.3** |
| 13 | Liq Heatmap | LIQUIDATIONS | 6.0 | 4.0 | 7.0 | 7.0 | **6.0** |
| 14 | Long/Short | FLOW | 6.0 | 7.0 | 7.0 | 5.0 | **6.3** |
| 15 | CVD | FLOW | 5.0 | 6.0 | 7.0 | 8.0 | **6.5** |
| 16 | Order Flow | FLOW | 7.0 | 7.0 | 5.0 | 7.0 | **6.5** |
| 17 | RSI Heatmap | FLOW | 7.0 | 8.0 | 6.0 | 5.0 | **6.5** |
| | **AVERAGE** | | **6.6** | **6.3** | **6.5** | **6.2** | **6.3** |

**Best Pages**: Funding Rates (7.5), Chart (7.4), Predictions (7.3), OI Heatmap (7.3)
**Worst Pages**: Liquidations (4.5), Liq Map (5.3), Liq Heatmap (6.0)

---

## CROSS-VALIDATION FINDINGS

### Pattern 1: Inconsistent Data Fetching (affects 5 pages)
The following pages use raw `setInterval` + `useState` instead of SWR:
- **Screener** (line 212)
- **Funding Heatmap** (line 89)
- **Open Interest** (line 74)
- **Long/Short** multi-symbol table (line 74)
- **Liquidation Heatmap** single orderbook tab

All other pages use `useApi` (SWR wrapper). This inconsistency means these 5 pages lack: deduplication, stale-while-revalidate, tab-focus re-fetch, and automatic error retry. They also flash loading spinners on every refresh cycle.

### Pattern 2: Red-Green Color Accessibility (affects 3 pages)
- **Funding Heatmap**: Pure red-green diverging scale
- **RSI Heatmap**: Red (overbought) / Green (oversold)
- **OI Heatmap**: Red (OI decrease) / Green (OI increase)

~8% of males have red-green colorblindness. All three heatmaps are effectively unusable for them.

### Pattern 3: `formatPrice` Missing $ Prefix (affects 2 files)
The `$` prefix was fixed in `orderflow/page.tsx` but NOT in:
- `orderflow/components/TapeView.tsx` (line 56-60)
- `orderflow/components/ExchangeDepthTable.tsx` (line 46-50)

### Pattern 4: Broken March 2026 API Integrations (affects 2 pages)
- **GMX V2**: `positionImpactFactorPositive/Negative` fields removed. Price impact is always zero in Execution Costs.
- **gTrade**: `pairDepths`, `pairSkewDepths`, `prices` removed from top level. Depth data degraded to crude fallback formula.
- **gTrade dynamic fee**: Fetched from chain but never used (hardcoded value used instead).

### Pattern 5: Liquidation Data Crisis (affects 3 pages)
- Binance `allForceOrders` deprecated March 2026 — returns empty across all liq pages
- Dedicated `/liquidations` page only uses OKX DB data (3 symbols), while the homepage widget uses 9-exchange WebSocket
- Cold starts on Vercel = empty heatmap for 4h view
- Liq Map uses 100% synthetic data with misleading 50/50 L/S bar

### Pattern 6: Backend More Capable Than Frontend (affects 3 pages)
- **Long/Short**: API supports OKX + topTraders + taker sources, frontend only shows Binance global
- **Execution Costs**: CEX venue fetchers exist but excluded from main ranking
- **OI Heatmap**: 1h/4h delta data available from API but UI only shows 24h

---

## TOP 15 CRITICAL FINDINGS

| # | Severity | Page | Finding |
|---|----------|------|---------|
| 1 | CRITICAL | Liquidations | Dedicated page ignores 9-exchange WebSocket hook, uses only OKX DB data |
| 2 | CRITICAL | Execution Costs | GMX price impact permanently broken (always zero) from removed API fields |
| 3 | CRITICAL | Liq Map | 50/50 L/S ratio bar is hardcoded — actively misleading users |
| 4 | CRITICAL | Execution Costs | gTrade dynamic fee fetched but never used in calculation |
| 5 | HIGH | Basis | OKX/dYdX/Lighter/Drift set markPrice===indexPrice, basis always 0% for ~17 exchanges |
| 6 | HIGH | Funding Rates | Accumulated funding mis-normalized for hourly exchanges (underestimated ~8x) |
| 7 | HIGH | Chart | Dropdown asset class switch doesn't auto-select symbol (functional bug) |
| 8 | HIGH | Options | Binance expiry timestamps use local timezone instead of UTC |
| 9 | HIGH | Liquidations | Sound toggle is completely fake (UI only, no audio implementation) |
| 10 | HIGH | Long/Short | `fetchBinanceTopTraderLS` uses wrong field names (returns NaN) |
| 11 | HIGH | Order Flow | formatPrice missing $ in TapeView and ExchangeDepthTable |
| 12 | MEDIUM | 3 pages | Red-green heatmap colors inaccessible to colorblind users |
| 13 | MEDIUM | 5 pages | Raw setInterval instead of SWR — loading flashes, no dedup |
| 14 | MEDIUM | Options | 1,310-line monolith needs splitting into 6+ components |
| 15 | MEDIUM | Open Interest | OI History Chart hardcoded to BTC regardless of search/filter |

---

## PRIORITIZED FIX LIST

### Immediate (This Week)
1. **Wire WebSocket hook to /liquidations page** — The `useMultiExchangeLiquidations` hook already exists with 9 exchanges. Just import and use it. (Est: 2 hours)
2. **Fix formatPrice in TapeView.tsx + ExchangeDepthTable.tsx** — Add `$` prefix to match page.tsx. (Est: 10 minutes)
3. **Remove or label Liq Map 50/50 bar** — Either feed real L/S ratio or add "Estimated" badge. (Est: 30 minutes)
4. **Fix Chart dropdown bug** — Call `switchAssetClass()` instead of `setAssetClass()` in dropdown sub-tabs. (Est: 15 minutes)
5. **Fix gTrade: use dynamic fee** — Replace `EXCHANGE_FEES['gTrade']?.taker ?? 0.05` with fetched `baseFeeP`. (Est: 30 minutes)

### Short-Term (This Sprint)
6. **Migrate 5 pages from setInterval to SWR** — Screener, Funding Heatmap, OI, Long/Short, Order Flow tab
7. **Fix Options timezone bug** — Replace `new Date(yr, mo, da, 8)` with `new Date(Date.UTC(yr, mo, da, 8))`
8. **Fix accumulated funding normalization** — Store `fundingInterval` alongside rate in snapshots
9. **Add colorblind-safe palettes** — Blue-orange scale option for all heatmaps
10. **Fix OI History Chart** — Make it respond to symbol filter instead of hardcoded BTC
11. **Fix GMX price impact** — Adopt new simplified impact model from updated API
12. **Fix Long/Short topTrader field names** — `longPosition`/`shortPosition` not `longAccount`/`shortAccount`

### Medium-Term (Next Month)
13. **Split Options page** — 1,310 lines into 6+ components
14. **Add WebSocket for funding/orderflow** — Client-side WS to Binance/Bybit for real-time data
15. **Fix Basis data** — Get separate mark/index prices for OKX, dYdX, Lighter, Drift
16. **Expand Long/Short UI** — Add exchange toggle, source toggle (backend already supports it)
17. **Add Bybit/Bitget liquidation feeds** — Replace lost Binance data
18. **OKX batch funding endpoint** — Replace N+1 per-instrument calls with batch API

### Long-Term (Next Quarter)
19. **WebSocket architecture** for orderbook, liquidations, and funding
20. **Mobile-first redesign** for all heatmap pages
21. **Data export (CSV/JSON)** on every page
22. **Alert system** — configurable threshold notifications
23. **Greeks calculation** for Options (Black-Scholes with existing IV/strike/spot data)
24. **Permanent block list** — Stop retrying BitMEX/Gate.io through circuit breaker

---

## BONUS: 5 INNOVATIVE FEATURE IDEAS

1. **Cross-Signal Dashboard** — When funding spikes positive + OI surges + L/S ratio extreme long = liquidation cascade incoming. Combine signals from Funding, OI, L/S, and Liquidation pages into one predictive alert panel.

2. **Execution Cost Optimizer** — "I want to open $500K BTC long" -> automatically calculate optimal exchange split (e.g., $200K Hyperliquid + $200K dYdX + $100K Binance) to minimize total slippage + fees.

3. **Funding Rate Arbitrage Bot Backtester** — Use the 30-day accumulated funding snapshots to backtest: "If I'd shorted BTC on Binance and longed on Hyperliquid for the past month, what would my P&L be?"

4. **Smart Liquidation Predictor** — Combine real OI data + leverage distribution model + current price to predict WHERE the next liquidation cascade will trigger. Show as a "danger zone" overlay on the chart page.

5. **Portfolio Risk Monitor** — Let users input their positions across exchanges. Show real-time funding cost, liquidation distance, and estimated execution cost to close each position.

---

## CATEGORY RANKINGS

### Best-in-Class Features (vs Competitors)
- **Funding Rates**: 33 exchanges (vs Coinglass ~20), multi-asset class, arb detection with profit calculator
- **Order Flow Slippage Table**: Multi-exchange execution cost comparison at various sizes — unique feature
- **Prediction Market Arbitrage**: Cross-platform Polymarket/Kalshi arb detection — no competitor offers this
- **Exchange Coverage**: 30 exchanges (16 CEX + 12 DEX) — industry-leading DEX coverage

### Needs Most Work
- **Liquidations Suite** (all 3 pages): Data crisis from Binance deprecation, architectural disconnect between homepage and dedicated pages
- **Options**: Feature-rich but massive monolith, no Greeks, timezone bugs
- **Execution Costs**: Core GMX/gTrade integrations broken since March 2026 API changes

---

*Report generated by the 18-Agent Dashboard Auditor*
*Supervisor Agent coordinating 17 specialist agents running in parallel*
