# Arbitrage View Mk2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Overhaul the arbitrage view with smart defaults, visual polish, grade filter tabs, export/share, and comparison mode.

**Architecture:** All changes are client-side in one component file (FundingArbitrageView.tsx, currently 842 lines). No API changes. New features are additive — state changes, new sub-components, and utility functions. URL search params for shareable links require `useSearchParams` from next/navigation.

**Tech Stack:** React 18, TypeScript, Next.js 14, Tailwind CSS, lucide-react icons

**Constraint:** Do NOT push to Vercel until user says.

**Design doc:** `docs/plans/2026-03-05-arbitrage-mk2-design.md`

---

### Task 1: Smart Defaults — Change Initial State

**Files:**
- Modify: `src/app/funding/components/FundingArbitrageView.tsx:184-193`

**Step 1: Change default sort and hideOutliers**

In the component's state initialization (lines 184-193), change:

```typescript
// Before:
const [sortKey, setSortKey] = useState<SortKey>('spread');
const [sortAsc, setSortAsc] = useState(false);
// ...
const [hideOutliers, setHideOutliers] = useState(false);

// After:
const [sortKey, setSortKey] = useState<SortKey>('grade');
const [sortAsc, setSortAsc] = useState(false);
// ...
const [hideOutliers, setHideOutliers] = useState(true);
```

**Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: 0 errors

**Step 3: Commit**

```bash
git add src/app/funding/components/FundingArbitrageView.tsx
git commit -m "feat(arb): smart defaults — sort by grade, hide outliers by default"
```

---

### Task 2: Grade Filter Tabs + Grade Distribution

**Files:**
- Modify: `src/app/funding/components/FundingArbitrageView.tsx`

**Step 1: Add gradeFilter state**

After `hideOutliers` state (line ~193), add:

```typescript
const [gradeFilter, setGradeFilter] = useState<FeasibilityGrade | 'all'>('all');
```

**Step 2: Compute grade counts from enriched data**

Add a `gradeCounts` useMemo after the `enriched` useMemo (after line ~292):

```typescript
const gradeCounts = useMemo(() => {
  const counts = { A: 0, B: 0, C: 0, D: 0 };
  for (const item of enriched) {
    counts[item.grade]++;
  }
  return counts;
}, [enriched]);
```

**Step 3: Add gradeFilter to the filtered useMemo**

In the `filtered` useMemo (line ~296), add after the `hideOutliers` check:

```typescript
if (gradeFilter !== 'all' && item.grade !== gradeFilter) return false;
```

**Step 4: Render grade filter pills**

Inside the main container `<div className="bg-hub-darker ...">`, right after the filters panel `{showFilters && ...}` block (after line ~491), add:

```tsx
{/* Grade Filter Tabs */}
<div className="px-4 py-2 border-b border-white/[0.06] flex items-center gap-1.5">
  <span className="text-neutral-500 text-[10px] mr-1">Grade:</span>
  {(['all', 'A', 'B', 'C', 'D'] as const).map(g => {
    const count = g === 'all' ? enriched.length : gradeCounts[g];
    const isActive = gradeFilter === g;
    const colors = g === 'all' ? (isActive ? 'bg-hub-yellow text-black' : 'text-neutral-500 bg-white/[0.04]')
      : isActive ? GRADE_COLORS[g] + ' ring-1' : 'text-neutral-600 bg-white/[0.04]';
    return (
      <button
        key={g}
        onClick={() => { setGradeFilter(g); setCurrentPage(1); }}
        className={`px-2 py-1 rounded text-[10px] font-semibold transition-colors ${colors}`}
      >
        {g === 'all' ? 'All' : g} <span className="opacity-60">{count}</span>
      </button>
    );
  })}
</div>
```

**Step 5: Verify**

Run: `npx tsc --noEmit`
Expected: 0 errors

**Step 6: Commit**

```bash
git add src/app/funding/components/FundingArbitrageView.tsx
git commit -m "feat(arb): grade filter tabs with A/B/C/D counts"
```

---

### Task 3: Summary Cards Overhaul

**Files:**
- Modify: `src/app/funding/components/FundingArbitrageView.tsx`

**Step 1: Update the summary useMemo**

Replace the existing `summary` useMemo (lines ~335-342) with:

```typescript
const summary = useMemo(() => {
  if (enriched.length === 0) return null;
  // Use enriched (not filtered) for summary so cards don't change with filters
  const realistic = enriched.filter(i => !i.isOutlier && !i.isLowLiq);
  const best = realistic.length > 0
    ? realistic.reduce((a, b) => b.grossSpread > a.grossSpread ? b : a, realistic[0])
    : enriched.reduce((a, b) => b.grossSpread > a.grossSpread ? b : a, enriched[0]);
  const avgNet = enriched.reduce((s, i) => s + i.netAnnualized, 0) / enriched.length;
  const totalOI = enriched.reduce((s, i) => s + i.totalOI, 0);
  // A-grade stats
  const aGrade = enriched.filter(i => i.grade === 'A');
  const aGradeAvg = aGrade.length > 0 ? aGrade.reduce((s, i) => s + i.netAnnualized, 0) / aGrade.length : 0;
  // Top pick: best A-grade opportunity, fall back to best B
  const topPick = aGrade.length > 0
    ? aGrade.reduce((a, b) => b.netAnnualized > a.netAnnualized ? b : a, aGrade[0])
    : enriched.filter(i => i.grade === 'B').reduce((a, b) => b ? (b.netAnnualized > a.netAnnualized ? b : a) : a, enriched[0]) || null;
  return { count: enriched.length, best, avgNet, totalOI, aGradeAvg, aGradeCount: aGrade.length, topPick };
}, [enriched]);
```

**Step 2: Update the summary card JSX**

Replace the 4 summary cards (lines ~354-391) with 5 cards. Modify the grid from `grid-cols-2 md:grid-cols-4` to `grid-cols-2 md:grid-cols-5`:

Card 1 — Opportunities: Add grade breakdown below count:
```tsx
<div className="text-neutral-600 text-[10px]">
  <span className="text-green-400">{gradeCounts.A}A</span>{' · '}
  <span className="text-blue-400">{gradeCounts.B}B</span>{' · '}
  <span className="text-amber-400">{gradeCounts.C}C</span>{' · '}
  <span className="text-red-400">{gradeCounts.D}D</span>
</div>
```

Card 2 — Best Spread: Change subtitle to include "(realistic)" when outliers are excluded.

Card 3 — Avg Net Ann.: Show A-grade average instead of overall:
```tsx
<div className="text-neutral-600 text-[10px]">
  {summary.aGradeCount > 0
    ? <><span className="text-green-400">A-grade</span> avg ({summary.aGradeCount} opps)</>
    : 'across all pairs'}
</div>
```
And change the value to use `summary.aGradeAvg` when A-grade exists.

Card 4 — Total OI: unchanged.

Card 5 (NEW) — Top Pick:
```tsx
<div className="bg-hub-darker border border-green-500/20 rounded-lg p-3">
  <div className="flex items-center gap-1.5 mb-1">
    <Shield className="w-3.5 h-3.5 text-green-400" />
    <span className="text-neutral-500 text-[10px] uppercase tracking-wider">Top Pick</span>
  </div>
  {summary.topPick ? (
    <>
      <div className="flex items-center gap-1.5">
        <TokenIconSimple symbol={summary.topPick.symbol} size={16} />
        <span className="text-white text-sm font-bold">{summary.topPick.symbol}</span>
        <span className={`px-1 py-0.5 rounded text-[8px] font-bold border ${GRADE_COLORS[summary.topPick.grade]}`}>{summary.topPick.grade}</span>
      </div>
      <div className="text-green-400 font-mono text-xs mt-0.5">+{summary.topPick.netAnnualized.toFixed(1)}% ann.</div>
      <div className="text-neutral-600 text-[10px]">{summary.topPick.high.exchange} / {summary.topPick.low.exchange}</div>
    </>
  ) : (
    <div className="text-neutral-600 text-sm">-</div>
  )}
</div>
```

**Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: 0 errors

**Step 4: Commit**

```bash
git add src/app/funding/components/FundingArbitrageView.tsx
git commit -m "feat(arb): summary cards overhaul — grade breakdown, A-grade avg, top pick card"
```

---

### Task 4: Visual Polish — Badge Consolidation

**Files:**
- Modify: `src/app/funding/components/FundingArbitrageView.tsx`

**Step 1: Create GradeBadge helper component**

Add after the `IntervalBadge` component (after line ~86):

```tsx
function GradeBadge({ grade, isOutlier, isLowLiq, score }: {
  grade: FeasibilityGrade; isOutlier: boolean; isLowLiq: boolean; score: number;
}) {
  const warnings = [isOutlier && '\u26A0', isLowLiq && '!'].filter(Boolean).join('');
  const tooltip = [
    `Feasibility: ${grade} (score ${score}/8)`,
    isOutlier && 'Spread >1%/8h — unusually high',
    isLowLiq && 'Min side OI <$50K — low liquidity',
  ].filter(Boolean).join('\n');
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold border ${GRADE_COLORS[grade]}`} title={tooltip}>
      {grade}{warnings && <span className="ml-0.5 text-[8px]">{warnings}</span>}
    </span>
  );
}
```

**Step 2: Replace grade badge + outlier/lowliq badges in desktop table**

In the desktop table row symbol cell (lines ~538-545), remove the separate OUTLIER and LOW LIQ badges. Replace the standalone grade badge (line ~548) with:

```tsx
<td className="px-3 py-2 text-center">
  <GradeBadge grade={item.grade} isOutlier={item.isOutlier} isLowLiq={item.isLowLiq} score={item.gradeScore} />
</td>
```

Remove from the symbol cell:
```tsx
// DELETE these two lines:
{item.isOutlier && <span className="px-1 py-0.5 ...">OUTLIER</span>}
{item.isLowLiq && <span className="px-1 py-0.5 ...">LOW LIQ</span>}
```

**Step 3: Update mobile card badge**

In the mobile card (line ~633), replace the grade badge + outlier indicator with:

```tsx
<GradeBadge grade={item.grade} isOutlier={item.isOutlier} isLowLiq={item.isLowLiq} score={item.gradeScore} />
```

Remove the separate `{item.isOutlier && ...}` line below it.

**Step 4: Verify**

Run: `npx tsc --noEmit`
Expected: 0 errors

**Step 5: Commit**

```bash
git add src/app/funding/components/FundingArbitrageView.tsx
git commit -m "feat(arb): consolidate outlier/low-liq badges into grade badge"
```

---

### Task 5: Visual Polish — Spread Column Cleanup

**Files:**
- Modify: `src/app/funding/components/FundingArbitrageView.tsx`

**Step 1: Rewrite the spread column cell**

Replace the spread `<td>` (lines ~564-577) with:

```tsx
<td className="px-3 py-2 text-right">
  <div>
    <div className="flex items-center justify-end gap-1">
      <span className="text-hub-yellow font-bold font-mono text-sm">{item.grossSpread.toFixed(4)}%</span>
      {item.trend === 'widening' && <span title="Spread widening (last 24h > prior 6d)"><TrendingUp className="w-3 h-3 text-green-400" /></span>}
      {item.trend === 'narrowing' && <span title="Spread narrowing (last 24h < prior 6d)"><TrendingDown className="w-3 h-3 text-red-400" /></span>}
    </div>
    <div className="flex items-center justify-end gap-1.5 text-[10px]">
      {item.netSpread < item.grossSpread && (
        <span className="text-neutral-600 font-mono" title={`Round-trip fees: ${item.roundTripFee.toFixed(3)}%`}>net {item.netSpread.toFixed(4)}%</span>
      )}
      {item.stability === 'stable' && <span className="text-green-400/70">Stable</span>}
      {item.stability === 'volatile' && <span className="text-amber-400/70">Volatile</span>}
      {item.stability === 'new' && <span className="text-neutral-600">New</span>}
    </div>
  </div>
</td>
```

**Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: 0 errors

**Step 3: Commit**

```bash
git add src/app/funding/components/FundingArbitrageView.tsx
git commit -m "feat(arb): cleaner spread column — inline trend arrows, text stability labels"
```

---

### Task 6: Visual Polish — Expanded Panel 2-Column Layout

**Files:**
- Modify: `src/app/funding/components/FundingArbitrageView.tsx`

**Step 1: Rewrite the ExpandedPanel component layout**

Replace the ExpandedPanel body (lines ~742-841) with a 2-column grid on desktop:

```tsx
return (
  <div className="space-y-3">
    {/* 2-column layout on desktop */}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Left: Exchange Rates + Feasibility */}
      <div className="space-y-3">
        <div>
          <div className="text-neutral-500 text-[10px] font-semibold uppercase tracking-wider mb-1.5">All Exchange Rates</div>
          <div className="flex flex-wrap gap-1.5">
            {/* existing exchange rate chips — unchanged */}
          </div>
        </div>
        {/* Feasibility Summary — moved here from below */}
        {(item.maxPractical > 0 || item.stability) && (
          <div className="flex flex-wrap items-center gap-3 text-[10px] bg-white/[0.02] rounded-lg p-2.5 border border-white/[0.04]">
            {/* existing feasibility content — unchanged */}
          </div>
        )}
      </div>
      {/* Right: Price Comparison */}
      {hasPrices && (
        <div>
          <div className="text-neutral-500 text-[10px] font-semibold uppercase tracking-wider mb-1.5">Price Comparison</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {/* existing price comparison cards — change lg:grid-cols-6 to grid-cols-3 */}
          </div>
        </div>
      )}
    </div>
    {/* Profit Calculator — full width below */}
    <div>
      <button onClick={() => setShowCalc(!showCalc)} className="...">
        {/* existing calculator toggle — unchanged */}
      </button>
      {showCalc && <ProfitCalculator ... />}
    </div>
  </div>
);
```

Key changes:
- Wrap exchange rates + feasibility in left column
- Price comparison in right column
- Feasibility gets a subtle background card (`bg-white/[0.02]`)
- Price grid changes from `lg:grid-cols-6` to `grid-cols-3` (fits in half-width)
- Calculator stays full-width below

**Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: 0 errors

**Step 3: Commit**

```bash
git add src/app/funding/components/FundingArbitrageView.tsx
git commit -m "feat(arb): 2-column expanded panel layout on desktop"
```

---

### Task 7: Visual Polish — Mobile Cards

**Files:**
- Modify: `src/app/funding/components/FundingArbitrageView.tsx`

**Step 1: Update mobile card layout**

In the mobile card (lines ~622-677), update the header row to make the grade badge larger and more prominent:

```tsx
<div className="flex items-center justify-between mb-2">
  <div className="flex items-center gap-2">
    <GradeBadge grade={item.grade} isOutlier={item.isOutlier} isLowLiq={item.isLowLiq} score={item.gradeScore} />
    <TokenIconSimple symbol={item.symbol} size={18} />
    <span className="text-white font-semibold text-sm">{item.symbol}</span>
  </div>
  <div className="flex items-center gap-1">
    {item.trend === 'widening' && <TrendingUp className="w-3 h-3 text-green-400" />}
    {item.trend === 'narrowing' && <TrendingDown className="w-3 h-3 text-red-400" />}
    <div className="text-right">
      <div className="text-hub-yellow font-bold font-mono text-sm">{item.grossSpread.toFixed(4)}%</div>
      {item.netSpread < item.grossSpread && (
        <div className="text-neutral-600 font-mono text-[9px]">net {item.netSpread.toFixed(4)}%</div>
      )}
    </div>
  </div>
</div>
```

Remove the chevron from inside the mobile card header (it was before TokenIcon).

**Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: 0 errors

**Step 3: Commit**

```bash
git add src/app/funding/components/FundingArbitrageView.tsx
git commit -m "feat(arb): improved mobile cards — prominent grade badge, net spread"
```

---

### Task 8: Export CSV

**Files:**
- Modify: `src/app/funding/components/FundingArbitrageView.tsx`

**Step 1: Add new icon import**

Add `Download` to the lucide-react import line (line 8).

**Step 2: Add exportCSV function**

Add after the `handleSort` function (after line ~332):

```typescript
const exportCSV = () => {
  const headers = ['Symbol', 'Grade', 'Price', 'Spread/8h', 'Net Spread/8h', 'Ann. %', 'Short Exchange', 'Short Rate', 'Long Exchange', 'Long Rate', 'Daily PnL', '30d PnL', 'OI', 'Stability', 'Trend'];
  const rows = sortedData.map(item => [
    item.symbol,
    item.grade,
    item.price > 0 ? item.price.toString() : '',
    item.grossSpread8h.toFixed(4),
    (item.grossSpread8h - item.roundTripFee).toFixed(4),
    item.netAnnualized.toFixed(1),
    item.high.exchange,
    (item.high.rate * periodScale).toFixed(4),
    item.low.exchange,
    (item.low.rate * periodScale).toFixed(4),
    item.dailyPnl.toFixed(2),
    item.monthlyPnl.toFixed(2),
    item.totalOI > 0 ? item.totalOI.toFixed(0) : '',
    item.stability || '',
    item.trend || '',
  ]);
  const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `infohub-arb-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};
```

**Step 3: Add Export button to header bar**

In the header bar (line ~401), add after the Filters button:

```tsx
<button onClick={exportCSV} className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium text-neutral-500 hover:text-white bg-white/[0.04] transition-colors">
  <Download className="w-3 h-3" /> Export
</button>
```

**Step 4: Verify**

Run: `npx tsc --noEmit`
Expected: 0 errors

**Step 5: Commit**

```bash
git add src/app/funding/components/FundingArbitrageView.tsx
git commit -m "feat(arb): export filtered arbitrage data to CSV"
```

---

### Task 9: Shareable Links (URL Params)

**Files:**
- Modify: `src/app/funding/components/FundingArbitrageView.tsx`

**Step 1: Add imports**

Add `Link2, Check` to lucide-react imports. Add `useSearchParams` usage note: since this component is dynamically imported inside a `'use client'` page, we can use `useSearchParams` from `next/navigation`. However, to keep it simpler and avoid Suspense boundary requirements, use `window.location.search` directly in a useEffect.

**Step 2: Add URL param initialization**

Add after the state declarations (after line ~193), a useEffect that reads URL params on mount:

```typescript
// Initialize from URL params (shareable links)
React.useEffect(() => {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams(window.location.search);
  const g = params.get('grade');
  if (g && ['A', 'B', 'C', 'D'].includes(g)) setGradeFilter(g as FeasibilityGrade);
  const v = params.get('venue');
  if (v && ['all', 'cex-dex', 'cex-cex'].includes(v)) setVenueFilter(v as VenueFilterType);
  const ex = params.get('exchange');
  if (ex) setExchangeFilter(ex);
  const ms = params.get('minSpread');
  if (ms) setMinSpread(parseFloat(ms) || 0);
  const mo = params.get('minOI');
  if (mo) setMinOI(parseInt(mo) || 0);
  const ho = params.get('hideOutliers');
  if (ho === 'false') setHideOutliers(false);
  if (ho === 'true') setHideOutliers(true);
  const sk = params.get('sort');
  if (sk && ['spread', 'annualized', 'dailyPnl', 'symbol', 'oi', 'grade'].includes(sk)) setSortKey(sk as SortKey);
  const sd = params.get('sortDir');
  if (sd === 'asc') setSortAsc(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

**Step 3: Add copyShareLink function**

Add after `exportCSV`:

```typescript
const [linkCopied, setLinkCopied] = React.useState(false);

const copyShareLink = () => {
  const params = new URLSearchParams();
  if (gradeFilter !== 'all') params.set('grade', gradeFilter);
  if (venueFilter !== 'all') params.set('venue', venueFilter);
  if (exchangeFilter) params.set('exchange', exchangeFilter);
  if (minSpread > 0) params.set('minSpread', String(minSpread));
  if (minOI > 0) params.set('minOI', String(minOI));
  if (!hideOutliers) params.set('hideOutliers', 'false'); // only encode non-default
  if (sortKey !== 'grade') params.set('sort', sortKey);
  if (sortAsc) params.set('sortDir', 'asc');
  const base = window.location.origin + window.location.pathname;
  const qs = params.toString();
  const url = qs ? `${base}?${qs}#arbitrage` : `${base}#arbitrage`;
  navigator.clipboard.writeText(url).then(() => {
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  });
};
```

**Step 4: Add Share button to header bar**

Next to the Export button:

```tsx
<button onClick={copyShareLink} className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors ${linkCopied ? 'bg-green-500/20 text-green-400' : 'text-neutral-500 hover:text-white bg-white/[0.04]'}`}>
  {linkCopied ? <Check className="w-3 h-3" /> : <Link2 className="w-3 h-3" />}
  {linkCopied ? 'Copied!' : 'Share'}
</button>
```

**Step 5: Verify**

Run: `npx tsc --noEmit`
Expected: 0 errors

**Step 6: Commit**

```bash
git add src/app/funding/components/FundingArbitrageView.tsx
git commit -m "feat(arb): shareable links with URL params for filters"
```

---

### Task 10: Comparison Mode — State + Toggle

**Files:**
- Modify: `src/app/funding/components/FundingArbitrageView.tsx`

**Step 1: Add comparison state**

After `linkCopied` state, add:

```typescript
const [compareMode, setCompareMode] = useState(false);
const [compareItems, setCompareItems] = useState<Set<string>>(new Set());

const toggleCompare = (symbol: string) => {
  setCompareItems(prev => {
    const next = new Set(prev);
    if (next.has(symbol)) next.delete(symbol);
    else if (next.size < 3) next.add(symbol);
    return next;
  });
};

const compareData = useMemo(() => {
  return enriched.filter(item => compareItems.has(item.symbol));
}, [enriched, compareItems]);
```

**Step 2: Add Compare button to header bar**

Add `GitCompareArrows` to lucide-react imports. Add after the Share button:

```tsx
<button
  onClick={() => { setCompareMode(!compareMode); if (compareMode) setCompareItems(new Set()); }}
  className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors ${compareMode ? 'bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/20' : 'text-neutral-500 hover:text-white bg-white/[0.04]'}`}
>
  <GitCompareArrows className="w-3 h-3" />
  Compare {compareItems.size > 0 && `(${compareItems.size})`}
</button>
```

**Step 3: Add checkbox to each table row**

In the desktop table row (line ~528), add as first element inside the `<tr>`:

After the `#` column `<td>`, if `compareMode` is active, add a checkbox cell. Actually simpler: add a checkbox inside the existing `#` cell:

```tsx
<td className="px-3 py-2 text-neutral-600 text-xs font-mono">
  <div className="flex items-center gap-1">
    {compareMode && (
      <input
        type="checkbox"
        checked={compareItems.has(item.symbol)}
        onChange={(e) => { e.stopPropagation(); toggleCompare(item.symbol); }}
        onClick={e => e.stopPropagation()}
        className="w-3 h-3 accent-blue-400"
      />
    )}
    {!compareMode && (expandedRow === item.symbol ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />)}
    {startIdx + index + 1}
  </div>
</td>
```

**Step 4: Verify**

Run: `npx tsc --noEmit`
Expected: 0 errors

**Step 5: Commit**

```bash
git add src/app/funding/components/FundingArbitrageView.tsx
git commit -m "feat(arb): comparison mode — toggle, checkboxes, state management"
```

---

### Task 11: Comparison Mode — Bottom Drawer Panel

**Files:**
- Modify: `src/app/funding/components/FundingArbitrageView.tsx`

**Step 1: Create ComparisonDrawer component**

Add before the main export:

```tsx
function ComparisonDrawer({ items, periodScale, onClear }: {
  items: any[]; periodScale: number; onClear: () => void;
}) {
  if (items.length === 0) return null;

  const metrics = [
    { label: 'Grade', key: 'grade', format: (i: any) => i.grade, best: 'max' },
    { label: 'Spread/8h', key: 'grossSpread8h', format: (i: any) => `${i.grossSpread8h.toFixed(4)}%`, best: 'max' },
    { label: 'Net Ann.', key: 'netAnnualized', format: (i: any) => `${i.netAnnualized > 0 ? '+' : ''}${i.netAnnualized.toFixed(1)}%`, best: 'max' },
    { label: 'Short', key: 'high', format: (i: any) => i.high.exchange, best: null },
    { label: 'Long', key: 'low', format: (i: any) => i.low.exchange, best: null },
    { label: 'Fees', key: 'roundTripFee', format: (i: any) => `${i.roundTripFee.toFixed(3)}%`, best: 'min' },
    { label: 'Daily PnL', key: 'dailyPnl', format: (i: any) => formatPnl(i.dailyPnl), best: 'max' },
    { label: 'OI', key: 'totalOI', format: (i: any) => i.totalOI > 0 ? formatUSD(i.totalOI) : '-', best: 'max' },
    { label: 'Stability', key: 'stability', format: (i: any) => i.stability || '-', best: null },
    { label: 'Trend', key: 'trend', format: (i: any) => i.trend || '-', best: null },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-hub-darker border-t border-white/[0.1] shadow-2xl z-50 max-h-[300px] overflow-y-auto">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-white text-sm font-semibold">Comparing {items.length} Opportunities</h4>
          <button onClick={onClear} className="text-neutral-500 hover:text-white text-xs px-2 py-1 rounded bg-white/[0.04]">Clear</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="py-1.5 pr-3 text-left text-neutral-500 text-[10px] font-semibold uppercase w-24">Metric</th>
                {items.map(item => (
                  <th key={item.symbol} className="py-1.5 px-3 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <TokenIconSimple symbol={item.symbol} size={14} />
                      <span className="text-white font-semibold">{item.symbol}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {metrics.map(metric => {
                const values = items.map(i => typeof i[metric.key] === 'number' ? i[metric.key] : null);
                const bestVal = metric.best === 'max' ? Math.max(...values.filter((v): v is number => v !== null))
                  : metric.best === 'min' ? Math.min(...values.filter((v): v is number => v !== null))
                  : null;
                return (
                  <tr key={metric.label} className="border-b border-white/[0.03]">
                    <td className="py-1.5 pr-3 text-neutral-500 text-[10px]">{metric.label}</td>
                    {items.map((item, idx) => {
                      const val = typeof item[metric.key] === 'number' ? item[metric.key] : null;
                      const isBest = bestVal !== null && val === bestVal && items.length > 1;
                      return (
                        <td key={item.symbol} className={`py-1.5 px-3 text-center font-mono ${isBest ? 'text-green-400' : 'text-neutral-300'}`}>
                          {metric.format(item)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Render the drawer**

At the very end of the component's return JSX (after the closing `</div>` of the main container, before the final `</div>`), add:

```tsx
{compareMode && compareData.length > 0 && (
  <ComparisonDrawer
    items={compareData}
    periodScale={periodScale}
    onClear={() => { setCompareMode(false); setCompareItems(new Set()); }}
  />
)}
```

**Step 3: Add bottom padding when drawer is open**

On the outermost `<div className="space-y-3">`, add conditional bottom padding:

```tsx
<div className={`space-y-3 ${compareMode && compareData.length > 0 ? 'pb-80' : ''}`}>
```

**Step 4: Verify**

Run: `npx tsc --noEmit`
Expected: 0 errors

**Step 5: Commit**

```bash
git add src/app/funding/components/FundingArbitrageView.tsx
git commit -m "feat(arb): comparison drawer — side-by-side metrics with best highlighting"
```

---

### Task 12: Final Verification + Visual QA

**Step 1: TypeScript check**

Run: `npx tsc --noEmit`
Expected: 0 errors

**Step 2: Dev server visual check**

1. Navigate to /funding, click Arbitrage
2. Verify: default view shows grade-sorted, outliers hidden
3. Verify: grade tabs show A/B/C/D counts, clicking filters correctly
4. Verify: summary cards show grade breakdown, A-grade avg, top pick
5. Verify: grade badges show warning indicators for outliers
6. Verify: spread column has inline trend + text stability labels
7. Verify: expanded panel is 2-column on desktop
8. Verify: Export CSV downloads file
9. Verify: Share button copies link, toast appears
10. Verify: Compare mode shows checkboxes, selecting 2+ opens drawer
11. Verify: comparison drawer highlights best values

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat(arb): mk2 complete — smart defaults, grade tabs, visual polish, export/share, comparison mode"
```
