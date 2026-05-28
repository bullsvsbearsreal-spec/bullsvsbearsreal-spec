'use client';

/**
 * Bottom panel with tab strip + table area below the chart. Tabs:
 *   · Funding     — per-venue funding rates for the active symbol
 *   · Liquidations— recent liquidations stream for the symbol
 *   · Position Sizer — quick links + mini sizer (links to /position-size)
 *   · Top Movers  — gainers / losers cards (matches screenshot 2)
 *
 * "Remember last" — selected tab persisted to localStorage so a
 * returning user lands on whatever they last had open. Default is
 * Funding for new users.
 */
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Percent, Zap, Ruler, TrendingUp, ChevronUp, ChevronDown } from 'lucide-react';
import { useFundingRates, useTickers } from '@/hooks/useSWRApi';

type TabKey = 'funding' | 'liquidations' | 'position-sizer' | 'top-movers';

const STORAGE_KEY = 'infohub_chart_bottom_tab_v1';
const COLLAPSE_KEY = 'infohub_chart_bottom_collapsed_v1';

interface FundingRow {
  symbol?: string;
  exchange?: string;
  fundingRate?: number;
  predictedRate?: number;
  markPrice?: number;
  indexPrice?: number;
  nextFundingTime?: number;
  fundingInterval?: string;
  fundingIntervalHours?: number;
}

interface LiquidationRow {
  exchange: string;
  symbol: string;
  side: 'long' | 'short';
  priceUsd: number;
  quantityUsd: number;
  timestamp: number;
}

export function TerminalBottomTabs({
  symbol,
  collapsed,
  onCollapseChange,
}: {
  symbol: string;
  collapsed: boolean;
  onCollapseChange: (c: boolean) => void;
}) {
  const [tab, setTab] = useState<TabKey>('funding');

  // Hydrate the remembered tab. Default = funding for first-time users.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'funding' || saved === 'liquidations' || saved === 'position-sizer' || saved === 'top-movers') {
        setTab(saved);
      }
    } catch { /* ignore */ }
  }, []);

  // Persist
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, tab); } catch { /* ignore */ }
  }, [tab]);

  return (
    <div className="flex flex-col h-full bg-black border-t border-white/[0.06]">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06]">
        <div className="flex items-center gap-4">
          <TabButton active={tab === 'funding'} onClick={() => { setTab('funding'); onCollapseChange(false); }} icon={Percent} label="Funding" />
          <TabButton active={tab === 'liquidations'} onClick={() => { setTab('liquidations'); onCollapseChange(false); }} icon={Zap} label="Liquidations" />
          <TabButton active={tab === 'position-sizer'} onClick={() => { setTab('position-sizer'); onCollapseChange(false); }} icon={Ruler} label="Position Sizer" />
          <TabButton active={tab === 'top-movers'} onClick={() => { setTab('top-movers'); onCollapseChange(false); }} icon={TrendingUp} label="Top Movers" />
        </div>
        <button
          onClick={() => onCollapseChange(!collapsed)}
          className="p-1 rounded text-neutral-500 hover:text-white hover:bg-white/[0.04] transition-colors"
          title={collapsed ? 'Expand panel' : 'Collapse for more chart space'}
        >
          {collapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>
      {!collapsed && (
        <div className="flex-1 min-h-0 overflow-y-auto">
          {tab === 'funding' && <FundingTab symbol={symbol} />}
          {tab === 'liquidations' && <LiquidationsTab symbol={symbol} />}
          {tab === 'position-sizer' && <PositionSizerTab symbol={symbol} />}
          {tab === 'top-movers' && <TopMoversTab />}
        </div>
      )}
    </div>
  );
}

function TabButton({
  active, onClick, icon: Icon, label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Percent;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex items-center gap-1.5 text-xs font-semibold transition-colors px-1 py-1 ${
        active
          ? 'text-cyan-400'
          : 'text-neutral-500 hover:text-white'
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
      {active && (
        // Underline scaled to match label width — sits inside tab strip's
        // border-b without doubling it up.
        <span className="absolute -bottom-[9px] left-0 right-0 h-[2px] bg-cyan-400 rounded-t" />
      )}
    </button>
  );
}

/* ─── Funding tab ─────────────────────────────────────────────────────── */

function FundingTab({ symbol }: { symbol: string }) {
  const { data } = useFundingRates('crypto');
  const rows = useMemo(() => {
    if (!data) return [];
    return (data as FundingRow[]).filter(r => (r.symbol ?? '').toUpperCase() === symbol.toUpperCase());
  }, [data, symbol]);

  if (rows.length === 0) {
    return <EmptyState message={`No funding data for ${symbol} yet`} />;
  }

  return (
    <table className="w-full text-xs font-mono">
      <thead>
        <tr className="text-[10px] uppercase tracking-wider text-neutral-500">
          <th className="text-left px-3 py-2">Venue</th>
          <th className="text-right px-3 py-2">Funding</th>
          <th className="text-right px-3 py-2">Premium</th>
          <th className="text-right px-3 py-2">Mark</th>
          <th className="text-right px-3 py-2">Next</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          const rate = r.fundingRate ?? 0;
          const tone = rate > 0 ? 'text-emerald-400' : rate < 0 ? 'text-red-400' : 'text-neutral-400';
          const premiumPct = (r.markPrice && r.indexPrice && r.indexPrice > 0)
            ? ((r.markPrice - r.indexPrice) / r.indexPrice) * 100
            : null;
          const next = r.nextFundingTime ? Math.max(0, r.nextFundingTime - Date.now()) : null;
          const nextStr = next !== null
            ? `${String(Math.floor(next / 3_600_000)).padStart(2, '0')}:${String(Math.floor((next % 3_600_000) / 60_000)).padStart(2, '0')}:${String(Math.floor((next % 60_000) / 1_000)).padStart(2, '0')}`
            : '—';
          return (
            <tr key={`${r.exchange}-${i}`} className="border-t border-white/[0.04] hover:bg-white/[0.02]">
              <td className="px-3 py-1.5 text-neutral-200">{r.exchange}</td>
              <td className={`px-3 py-1.5 text-right ${tone}`}>{rate >= 0 ? '+' : ''}{rate.toFixed(4)}%</td>
              <td className="px-3 py-1.5 text-right text-neutral-400">
                {premiumPct !== null ? `${premiumPct >= 0 ? '+' : ''}${premiumPct.toFixed(3)}%` : '—'}
              </td>
              <td className="px-3 py-1.5 text-right text-neutral-300">
                {r.markPrice ? `$${r.markPrice.toLocaleString('en-US', { maximumFractionDigits: 2 })}` : '—'}
              </td>
              <td className="px-3 py-1.5 text-right text-neutral-500">{nextStr}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/* ─── Liquidations tab ────────────────────────────────────────────────── */

function LiquidationsTab({ symbol }: { symbol: string }) {
  const [rows, setRows] = useState<LiquidationRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetch(`/api/liquidations?symbol=${encodeURIComponent(symbol)}&hours=1&limit=50`, {
          signal: AbortSignal.timeout(10_000),
        });
        if (!r.ok) return;
        const j = await r.json();
        const list: LiquidationRow[] = Array.isArray(j) ? j : (j?.data ?? j?.liquidations ?? []);
        if (!cancelled) setRows(list.slice(0, 50));
      } catch { /* ignore */ }
      finally { if (!cancelled) setLoading(false); }
    };
    setLoading(true);
    load();
    const id = setInterval(load, 15_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [symbol]);

  if (loading && rows.length === 0) {
    return <EmptyState message="Loading liquidations…" />;
  }
  if (rows.length === 0) {
    return <EmptyState message={`No liquidations for ${symbol} in the last hour`} />;
  }

  return (
    <table className="w-full text-xs font-mono">
      <thead>
        <tr className="text-[10px] uppercase tracking-wider text-neutral-500">
          <th className="text-left px-3 py-2">Venue</th>
          <th className="text-left px-3 py-2">Side</th>
          <th className="text-right px-3 py-2">Price</th>
          <th className="text-right px-3 py-2">Value (USD)</th>
          <th className="text-right px-3 py-2">Time</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          const sideColor = r.side === 'long' ? 'text-red-400' : 'text-emerald-400';
          return (
            <tr key={`${r.timestamp}-${i}`} className="border-t border-white/[0.04] hover:bg-white/[0.02]">
              <td className="px-3 py-1.5 text-neutral-300">{r.exchange}</td>
              <td className={`px-3 py-1.5 ${sideColor} uppercase text-[10px] font-bold`}>{r.side}</td>
              <td className="px-3 py-1.5 text-right text-neutral-300">${r.priceUsd.toFixed(2)}</td>
              <td className={`px-3 py-1.5 text-right ${r.quantityUsd > 100_000 ? 'text-cyan-400' : 'text-neutral-300'}`}>
                ${r.quantityUsd.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </td>
              <td className="px-3 py-1.5 text-right text-neutral-500 text-[10px]">
                {ageString(Date.now() - r.timestamp)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function ageString(ms: number): string {
  if (ms < 60_000) return `${Math.floor(ms / 1_000)}s ago`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  return `${Math.floor(ms / 3_600_000)}h ago`;
}

/* ─── Position Sizer tab ──────────────────────────────────────────────── */

function PositionSizerTab({ symbol }: { symbol: string }) {
  return (
    <div className="p-6 max-w-3xl">
      <div className="text-xs text-neutral-400 mb-3 leading-relaxed">
        Open the full sizer with this symbol prefilled, or jump to one of the related tools.
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Link
          href={`/position-size?symbol=${symbol}`}
          className="flex items-center gap-3 p-4 rounded-lg border border-white/[0.08] bg-white/[0.02] hover:border-cyan-400/40 hover:bg-cyan-400/[0.04] transition-colors"
        >
          <Ruler className="w-6 h-6 text-cyan-400" />
          <div>
            <div className="text-sm font-semibold text-white">Position Sizer</div>
            <div className="text-[11px] text-neutral-500">Risk-based notional + Kelly + liq preview</div>
          </div>
        </Link>
        <Link
          href={`/liquidation-map?symbol=${symbol}`}
          className="flex items-center gap-3 p-4 rounded-lg border border-white/[0.08] bg-white/[0.02] hover:border-cyan-400/40 hover:bg-cyan-400/[0.04] transition-colors"
        >
          <Zap className="w-6 h-6 text-cyan-400" />
          <div>
            <div className="text-sm font-semibold text-white">Liquidation Map</div>
            <div className="text-[11px] text-neutral-500">Where the leverage clusters sit</div>
          </div>
        </Link>
        <Link
          href={`/funding-arb?symbol=${symbol}`}
          className="flex items-center gap-3 p-4 rounded-lg border border-white/[0.08] bg-white/[0.02] hover:border-cyan-400/40 hover:bg-cyan-400/[0.04] transition-colors"
        >
          <Percent className="w-6 h-6 text-cyan-400" />
          <div>
            <div className="text-sm font-semibold text-white">Funding Arb</div>
            <div className="text-[11px] text-neutral-500">Long/short across venues, harvest the spread</div>
          </div>
        </Link>
        <Link
          href={`/alerts?symbol=${symbol}`}
          className="flex items-center gap-3 p-4 rounded-lg border border-white/[0.08] bg-white/[0.02] hover:border-cyan-400/40 hover:bg-cyan-400/[0.04] transition-colors"
        >
          <TrendingUp className="w-6 h-6 text-cyan-400" />
          <div>
            <div className="text-sm font-semibold text-white">Set an Alert</div>
            <div className="text-[11px] text-neutral-500">Price / funding / OI threshold pings</div>
          </div>
        </Link>
      </div>
    </div>
  );
}

/* ─── Top Movers tab ──────────────────────────────────────────────────── */

interface MoverRow {
  symbol: string;
  price: number;
  changePct: number;
}

function TopMoversTab() {
  const { data } = useTickers();
  const movers = useMemo(() => {
    if (!data) return { gainers: [], losers: [] } as { gainers: MoverRow[]; losers: MoverRow[] };
    type T = { symbol?: string; lastPrice?: number; price?: number; priceChangePercent24h?: number; changePercent24h?: number };
    // Aggregate per symbol (avg change across venues) since the same
    // symbol appears multiple times (one row per venue).
    const bySymbol = new Map<string, { totalChange: number; count: number; price: number }>();
    for (const r of data as T[]) {
      const sym = (r.symbol ?? '').toUpperCase();
      if (!sym) continue;
      const change = r.priceChangePercent24h ?? r.changePercent24h ?? 0;
      const price = r.lastPrice ?? r.price ?? 0;
      const cur = bySymbol.get(sym) ?? { totalChange: 0, count: 0, price };
      cur.totalChange += change;
      cur.count += 1;
      if (price > 0) cur.price = price;
      bySymbol.set(sym, cur);
    }
    const rows: MoverRow[] = Array.from(bySymbol, ([sym, v]) => ({
      symbol: sym,
      price: v.price,
      changePct: v.totalChange / v.count,
    })).filter(r => Number.isFinite(r.changePct));
    const gainers = [...rows].sort((a, b) => b.changePct - a.changePct).slice(0, 5);
    const losers = [...rows].sort((a, b) => a.changePct - b.changePct).slice(0, 5);
    return { gainers, losers };
  }, [data]);

  return (
    <div className="p-4 grid grid-cols-2 gap-4">
      <MoverCard title="Gainers" rows={movers.gainers} tone="pos" />
      <MoverCard title="Losers" rows={movers.losers} tone="neg" />
    </div>
  );
}

function MoverCard({ title, rows, tone }: { title: string; rows: MoverRow[]; tone: 'pos' | 'neg' }) {
  const accent = tone === 'pos' ? 'text-emerald-400' : 'text-red-400';
  const arrow = tone === 'pos' ? '↑' : '↓';
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.06]">
        <span className={`text-xs font-bold uppercase tracking-wider ${accent}`}>
          {arrow} {title}
        </span>
        <Link href="/screener" className="text-[10px] text-neutral-400 hover:text-white uppercase tracking-wider">
          View all →
        </Link>
      </div>
      <ul>
        {rows.length === 0 && (
          <li className="px-4 py-4 text-xs text-neutral-500">Loading…</li>
        )}
        {rows.map((r, i) => (
          <li key={r.symbol} className="flex items-center justify-between px-4 py-2 text-sm">
            <span className="flex items-center gap-2">
              <span className="text-neutral-500 text-[10px] font-mono w-3">{i + 1}</span>
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-white/[0.06] text-[9px] font-bold">
                {r.symbol.slice(0, 1)}
              </span>
              <span className="text-neutral-200 font-semibold">{r.symbol}</span>
              {r.price > 0 && (
                <span className="text-[10px] text-neutral-500 font-mono">
                  ${r.price < 1 ? r.price.toFixed(4) : r.price.toFixed(0)}
                </span>
              )}
            </span>
            <span className={`font-mono text-sm font-semibold ${accent}`}>
              {r.changePct >= 0 ? '+' : ''}{r.changePct.toFixed(2)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ─── Misc ────────────────────────────────────────────────────────────── */

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-32 text-xs text-neutral-500">
      {message}
    </div>
  );
}
