# Arbitrage View Mk2 — Design Document

**Date**: 2026-03-05
**Scope**: Smart defaults, visual polish, grade tabs, export/share, comparison mode
**File**: `src/app/funding/components/FundingArbitrageView.tsx` (primary)
**Constraint**: Do NOT push to Vercel until user says.

---

## 1. Smart Defaults + Summary Overhaul

### 1a. Default Behavior Changes
- `hideOutliers` defaults to `true` (was `false`)
- Default sort by `grade` descending (was `spread` descending)
- Best opportunities (A/B grade) surface first on initial load

### 1b. Summary Cards (4 → 5)
| Card | Change |
|------|--------|
| Opportunities | Add grade breakdown: "42A · 156B · 289C · 170D" |
| Best Spread | Show best *non-outlier* spread instead of raw highest |
| Avg Net Ann. | Show A-grade average: "A-grade avg: +48.2%" |
| Total OI | Unchanged |
| **Top Pick** (NEW) | Best A-grade opp: symbol + exchanges + spread, highlighted card |

### 1c. Grade Filter Tabs
- Row of pill buttons below summary cards: `[All] [A ·42] [B ·156] [C ·289] [D ·170]`
- Click to filter by grade, works alongside existing filters
- New state: `gradeFilter: FeasibilityGrade | 'all'`
- Integrate into `filtered` useMemo

---

## 2. Visual Polish

### 2a. Spread Column Cleanup
**Before:** `[↑] 22.7271% [•]` + `net 22.4971%` below
**After:** `22.7271% ↑` + `net 22.50% Stable` below
- Trend arrow moves inline right of spread value
- Stability dot → text label ("Stable" / "Volatile" / "New") below net spread
- Keeps tooltips for detail

### 2b. Badge Consolidation
**Before:** `EIGEN 11 exch [OUTLIER] [LOW LIQ] [D]`
**After:** `EIGEN 11 exch [D ⚠]`
- Merge outlier/low-liq indicators into grade badge
- `D` → `D ⚠` when outlier, `D !` when low liq, `D ⚠!` when both
- Tooltip explains why

### 2c. Expanded Panel — 2-Column Layout (Desktop)
- Left column: All Exchange Rates chips + Feasibility stats
- Right column: Price Comparison grid
- Profit calculator stays full-width below both columns
- Mobile: stays single-column stacked

### 2d. Mobile Cards
- Larger grade badge (left-aligned, more prominent)
- Show net spread value under gross spread

---

## 3. Export / Share

### 3a. Export CSV
- "Export" button in header bar (next to Filters)
- Exports currently filtered+sorted data as CSV
- Columns: Symbol, Grade, Price, Spread/8h, Net Spread, Annualized, Short Exchange, Short Rate, Long Exchange, Long Rate, Daily PnL, 30d PnL, OI, Stability, Trend
- Uses Blob + URL.createObjectURL for client-side download

### 3b. Copy Shareable Link
- "Share" button encodes current filters as URL search params
- Params: `grade`, `venue`, `exchange`, `minSpread`, `minOI`, `hideOutliers`, `sort`, `sortDir`
- On page load, read URL params and initialize state from them
- Uses `navigator.clipboard.writeText()` + toast notification

---

## 4. Comparison Mode

### 4a. UI Flow
- "Compare" toggle button in header bar
- When active: checkbox appears on each table row
- Select 2-3 opportunities (max 3)
- Bottom drawer slides up with side-by-side comparison panel

### 4b. Comparison Panel
- Fixed bottom drawer (like a sticky footer), ~250px tall
- 2-3 columns showing selected opportunities:
  - Symbol, Grade, Spread, Net Spread, Annualized
  - Short/Long exchanges, fees
  - OI, Daily PnL, Stability, Trend
  - Break-even days
- Best value per metric highlighted in green
- "Clear" button exits comparison mode + closes drawer

### 4c. State
- `compareMode: boolean` — toggle
- `compareItems: Set<string>` — selected symbols (max 3)
- Comparison data derived from `enriched` array

---

## Implementation Order

1. Smart defaults + grade tabs + summary overhaul
2. Visual polish (badges, spread column, expanded panel 2-col)
3. Export CSV + shareable links
4. Comparison mode

## Files Modified
- `src/app/funding/components/FundingArbitrageView.tsx` — all changes
- No API changes needed (sparklines dropped)
