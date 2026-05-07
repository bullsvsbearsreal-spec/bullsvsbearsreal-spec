'use client';

/**
 * /positions — funding-aware portfolio view (christian's mockup).
 *
 * Top summary row:    equity, nominal, totalLong, totalShort, leverageLong, leverageShort
 * Per-position table: ticker, direction, size, price, value, P&L, TP, SL,
 *                     cumulative funding, current funding, 24h, 48h
 *
 * Funding cells are direction-aware:
 *   long  + positive rate → longs pay (bad, red)
 *   long  + negative rate → longs receive (good, green)
 *   short + positive rate → shorts receive (good, green)
 *   short + negative rate → shorts pay (bad, red)
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import {
  RefreshCw,
  Lock,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  ExternalLink,
  Filter,
  Loader2,
} from 'lucide-react';
// Funding interval lookup + cost-of-carry math; shared with API route.
import { intervalHoursFor, dailyFundingCarryUsd } from '@/lib/funding-intervals';

interface Position {
  id: number;
  exchange: string;
  symbol: string;
  side: 'long' | 'short';
  size: number;
  entryPrice: number;
  markPrice: number | null;
  positionValue: number | null;
  unrealizedPnl: number | null;
  leverage: number | null;
  marginUsed: number | null;
  liquidationPrice: number | null;
  tpPrice: number | null;
  slPrice: number | null;
  cumulativeFunding: number | null;
  currentFunding: number | null;
  avg24hFunding: number | null;
  avg48hFunding: number | null;
  /** 0-100 position health score (computed server-side; 0 = critical, 100 = healthy). */
  healthScore: number;
  healthLabel: 'critical' | 'risky' | 'caution' | 'ok' | 'healthy';
  healthFactors: {
    liqBuffer: number;
    leverage: number;
    stopLoss: number;
    funding: number;
    profitability: number;
  };
  /** 1-3 short reasons the score is dragged down (empty when score >= 80). */
  healthReasons: string[];
  /** Projected daily funding cost in USD (positive = receiving, negative = paying). */
  dailyFundingCarryUsd: number | null;
  updatedAt: string;
}

interface Summary {
  equity: number;
  nominal: number;
  totalLong: number;
  totalShort: number;
  leverageLong: number;
  leverageShort: number;
  totalUnrealizedPnl: number;
  /** Aggregate net daily funding carry across the whole book in USD. null = no live rates. */
  dailyFundingCarryUsd: number | null;
}

interface ApiResponse {
  summary: Summary;
  positions: Position[];
  ts: number;
}

// ─── Formatting helpers ─────────────────────────────────────────────────

function fmtUsd(n: number | null | undefined, opts: { sign?: boolean } = {}): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  const sign = opts.sign && n > 0 ? '+' : '';
  if (Math.abs(n) >= 1e9) return `${sign}$${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `${sign}$${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3) return `${sign}$${(n / 1e3).toFixed(1)}K`;
  return `${sign}$${n.toFixed(2)}`;
}

function fmtPrice(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  if (Math.abs(n) >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (Math.abs(n) >= 1) return n.toFixed(2);
  if (Math.abs(n) >= 0.01) return n.toFixed(4);
  return n.toFixed(6);
}

function fmtSize(n: number): string {
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  if (Math.abs(n) >= 1) return n.toFixed(3);
  return n.toFixed(6);
}

function fmtPct(n: number | null | undefined, opts: { sign?: boolean; digits?: number } = {}): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  const d = opts.digits ?? 3;
  // Round FIRST so values that round to zero at the requested precision
  // display as "0.0000%" without a misleading "-0.0000%" sign.
  const factor = Math.pow(10, d);
  const rounded = Math.round(n * factor) / factor;
  const isZero = rounded === 0;
  const sign = opts.sign && rounded > 0 && !isZero ? '+' : '';
  // Use absolute value when rendering an unsigned/zero result so JS doesn't
  // emit "-0.0000" from negative-zero arithmetic.
  const display = isZero ? Math.abs(rounded).toFixed(d) : rounded.toFixed(d);
  return `${sign}${display}%`;
}

function fmtLeverage(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '—';
  // Below 0.1× the rounding-to-1-digit produced "0.0x" which made tiny
  // shorts look like zero exposure (e.g. $607K / $12.7M equity = 0.048×).
  // Bump to 2 digits when under 1× so "0.05x" surfaces real-but-small
  // leverage; keep 1 digit for the more common ≥1× range.
  if (n < 0.1) return `${n.toFixed(2)}x`;
  if (n < 1)   return `${n.toFixed(2)}x`;
  return `${n.toFixed(1)}x`;
}

/** Returns 'good' / 'bad' / 'neutral' for a funding rate given position side. */
function fundingTone(side: 'long' | 'short', rate: number | null | undefined): 'good' | 'bad' | 'neutral' {
  if (rate === null || rate === undefined || !Number.isFinite(rate)) return 'neutral';
  if (Math.abs(rate) < 0.001) return 'neutral'; // basically flat
  // long  + positive → longs pay → BAD; long  + negative → longs get → GOOD
  // short + positive → shorts get → GOOD; short + negative → shorts pay → BAD
  if (side === 'long')  return rate > 0 ? 'bad' : 'good';
  /* short */            return rate > 0 ? 'good' : 'bad';
}

/**
 * Funding-settlement interval per exchange in HOURS. Used to annualize the
 * displayed per-period rate so users can compare a 1h venue (HL/dYdX/GMX)
 * vs an 8h venue (Binance/Bybit/OKX) at a glance — without this, "+0.0008%"
 * looks identical across the two even though the 1h venue is paying 8×
 * more per day. Falls back to 8h for unknown exchanges (the common case).
 */
// (intervalHoursFor / FUNDING_INTERVAL_HOURS now in src/lib/funding-intervals.ts.)

/**
 * Convert a per-period rate (in PERCENT units) to annualised APR (in
 * percent units). 1h venue with 0.001% rate = 0.001 × 24 × 365 = 8.76%.
 * 8h venue with same nominal rate annualises to 1.10%.
 */
function annualizeRate(ratePct: number, intervalHours: number): number {
  if (!Number.isFinite(ratePct) || intervalHours <= 0) return 0;
  return ratePct * (24 * 365 / intervalHours);
}

/** Compact APR formatter — "+0.0%" if too small, "+8.76%" otherwise. */
function fmtApr(apr: number | null | undefined): string {
  if (apr == null || !Number.isFinite(apr)) return '—';
  const abs = Math.abs(apr);
  const sign = apr > 0 ? '+' : apr < 0 ? '-' : '';
  const digits = abs >= 100 ? 0 : abs >= 10 ? 1 : 2;
  return `${sign}${abs.toFixed(digits)}%`;
}

const TONE_CLASS: Record<'good' | 'bad' | 'neutral', string> = {
  good: 'text-emerald-400',
  bad: 'text-red-400',
  neutral: 'text-neutral-500',
};

// ─── Component ─────────────────────────────────────────────────────────

export default function PositionsPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authError, setAuthError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [exchangeFilter, setExchangeFilter] = useState<string>('');

  const load = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const res = await fetch('/api/account/positions', { signal: AbortSignal.timeout(15000) });
      if (res.status === 401) { setAuthError(true); return; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as ApiResponse;
      setData(json);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load(false);
    const iv = setInterval(() => load(true), 30_000);
    return () => clearInterval(iv);
  }, [load]);

  const exchanges = useMemo(() => {
    const s = new Set<string>();
    (data?.positions ?? []).forEach(p => s.add(p.exchange));
    return Array.from(s).sort();
  }, [data?.positions]);

  const filtered = useMemo(() => {
    if (!exchangeFilter) return data?.positions ?? [];
    return (data?.positions ?? []).filter(p => p.exchange === exchangeFilter);
  }, [data?.positions, exchangeFilter]);

  // ─── Auth wall ───────────────────────────────────────────────────
  if (authError) {
    return (
      <>
        <Header />
        <main className="max-w-[900px] mx-auto px-4 py-12 text-center">
          <Lock className="w-10 h-10 mx-auto text-neutral-600 mb-3" />
          <h1 className="text-lg font-semibold text-white mb-2">Sign in required</h1>
          <p className="text-sm text-neutral-500 mb-4">
            Sign in to see your unified portfolio across connected CEX keys + DEX wallets.
          </p>
          <a href="/login" className="inline-block bg-hub-yellow text-black text-sm font-semibold px-4 py-2 rounded-md hover:bg-hub-yellow/90">
            Sign in
          </a>
        </main>
        <Footer />
      </>
    );
  }

  // ─── Empty state (signed in but no positions) ───────────────────
  const isEmpty = data && data.positions.length === 0;

  return (
    <>
      <Header />
      <main className="max-w-[1500px] mx-auto w-full px-4 py-6">
        {/* Hero */}
        <div className="mb-5 flex items-center gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-white">Positions</h1>
            <p className="text-sm text-neutral-500 mt-0.5">
              Unified view of your open positions across connected accounts. Funding columns
              are direction-aware: green = funding favors your side, red = funding against you.
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/positions/journal"
              className="inline-flex items-center gap-1 text-xs text-hub-yellow hover:text-hub-yellow/80 px-2 py-1 rounded border border-hub-yellow/30 bg-hub-yellow/5"
              title="Trade Journal — every closed trade with realised PnL chart."
            >
              📔 Journal
            </Link>
            <Link
              href="/positions/tax"
              className="inline-flex items-center gap-1 text-xs text-hub-yellow hover:text-hub-yellow/80 px-2 py-1 rounded border border-hub-yellow/30 bg-hub-yellow/5"
              title="Tax / Cost-Basis — FIFO realised PnL across all your wallets/keys."
            >
              🧾 Tax
            </Link>
            <Link
              href="/positions/simulate"
              className="inline-flex items-center gap-1 text-xs text-hub-yellow hover:text-hub-yellow/80 px-2 py-1 rounded border border-hub-yellow/30 bg-hub-yellow/5"
              title="What if I open this position? Pre-trade decision engine."
            >
              🧮 Simulate trade
            </Link>
            <Link
              href="/account/connections"
              className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-hub-yellow"
            >
              Manage connections <ExternalLink className="w-3 h-3" />
            </Link>
            <button
              onClick={() => load(false)}
              disabled={refreshing}
              className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-hub-yellow disabled:opacity-40"
            >
              <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} /> refresh
            </button>
          </div>
        </div>

        {/* Loading skeleton on first paint */}
        {!data && !error && (
          <div className="card-premium p-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-neutral-600 mb-2" />
            <p className="text-sm text-neutral-500">loading positions…</p>
          </div>
        )}

        {/* Error state */}
        {error && !data && (
          <div className="card-premium p-6 text-center">
            <p className="text-red-400 text-sm">Failed to load · {error}</p>
            <button onClick={() => load(false)} className="mt-2 text-xs text-hub-yellow hover:underline">retry</button>
          </div>
        )}

        {/* Empty state — guide user to /account/connections */}
        {isEmpty && (
          <div className="card-premium p-10 text-center">
            <TrendingUp className="w-10 h-10 mx-auto text-neutral-700 mb-3" />
            <h2 className="text-base font-semibold text-white mb-1">No open positions</h2>
            <p className="text-sm text-neutral-500 mb-4">
              {data && (data.summary.equity === 0 && data.summary.nominal === 0)
                ? 'Connect a CEX API key or wallet to start tracking your positions.'
                : 'You have no open positions across connected accounts right now.'}
            </p>

            {/* Coverage hint — show users WHICH protocols they can track and
                 how (CEX key vs wallet, which chain to pick). Surfaces the
                 fact that one Arbitrum 0x… address covers GMX V2 + gTrade,
                 and one Ethereum L1 address covers Lighter — info that's
                 otherwise buried in /account/connections. */}
            <div className="max-w-2xl mx-auto mb-5 grid sm:grid-cols-2 gap-3 text-left">
              <div className="rounded-md bg-white/[0.02] border border-white/[0.06] p-3">
                <div className="text-[10px] uppercase tracking-wider text-emerald-400 font-semibold mb-1.5">CEX (API key)</div>
                <div className="text-[11px] text-neutral-400 leading-relaxed">
                  Binance · Bybit · OKX · Bitget
                  <span className="block mt-1 text-[10px] text-neutral-600">Use READ-ONLY keys.</span>
                </div>
              </div>
              <div className="rounded-md bg-white/[0.02] border border-white/[0.06] p-3">
                <div className="text-[10px] uppercase tracking-wider text-sky-400 font-semibold mb-1.5">DEX (wallet)</div>
                <div className="text-[11px] text-neutral-400 leading-relaxed space-y-0.5">
                  <div><span className="text-neutral-500">Hyperliquid</span> · paste your HL 0x… address</div>
                  <div><span className="text-neutral-500">Arbitrum</span> · GMX V2 (Arb + Avax) <span className="text-amber-400/70 text-[10px]">+ gTrade soon</span></div>
                  <div><span className="text-neutral-500">Ethereum</span> · Lighter (L1 register addr)</div>
                </div>
              </div>
            </div>

            <Link
              href="/account/connections"
              className="inline-block bg-sky-500 text-black text-sm font-semibold px-3 py-1.5 rounded-md hover:bg-sky-400"
            >
              Manage connections →
            </Link>
            <p className="text-[10px] text-neutral-600 mt-3">Sync runs every 60 seconds. Just connected? Wait a minute.</p>
          </div>
        )}

        {/* ─── Summary row (matches mockup top) ─── */}
        {data && data.positions.length > 0 && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 mb-2">
              <SummaryCell label="Equity" value={fmtUsd(data.summary.equity)} sub="margin + uPnL" />
              <SummaryCell label="Nominal" value={fmtUsd(data.summary.nominal)} sub="total exposure" />
              <SummaryCell label="Total long" value={fmtUsd(data.summary.totalLong)} valueColor="text-emerald-400" />
              <SummaryCell label="Total short" value={fmtUsd(data.summary.totalShort)} valueColor="text-red-400" />
              <SummaryCell label="Leverage long" value={fmtLeverage(data.summary.leverageLong)} valueColor="text-emerald-400" />
              <SummaryCell label="Leverage short" value={fmtLeverage(data.summary.leverageShort)} valueColor="text-red-400" />
            </div>
            {/* Funding carry projection: assumes the live rate holds. */}
            {data.summary.dailyFundingCarryUsd != null && (
              <FundingCarryStrip dailyCarry={data.summary.dailyFundingCarryUsd} />
            )}
          </>
        )}

        {/* ─── Exchange filter chips ─── */}
        {data && data.positions.length > 0 && exchanges.length > 1 && (
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <Filter className="w-3.5 h-3.5 text-neutral-500" />
            <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium mr-1">filter</span>
            <button
              onClick={() => setExchangeFilter('')}
              className={`text-[11px] px-2 py-1 rounded-md transition-colors ${
                exchangeFilter === '' ? 'bg-hub-yellow/20 text-hub-yellow ring-1 ring-hub-yellow/40' : 'bg-white/[0.04] text-neutral-400 hover:bg-white/[0.08]'
              }`}
            >
              all ({data.positions.length})
            </button>
            {exchanges.map(ex => {
              const count = data.positions.filter(p => p.exchange === ex).length;
              return (
                <button
                  key={ex}
                  onClick={() => setExchangeFilter(ex)}
                  className={`text-[11px] px-2 py-1 rounded-md transition-colors ${
                    exchangeFilter === ex ? 'bg-hub-yellow/20 text-hub-yellow ring-1 ring-hub-yellow/40' : 'bg-white/[0.04] text-neutral-400 hover:bg-white/[0.08]'
                  }`}
                >
                  {ex} ({count})
                </button>
              );
            })}
          </div>
        )}

        {/* ─── Positions: desktop table ─── */}
        {data && data.positions.length > 0 && (
          <div className="card-premium overflow-x-auto hidden md:block">
            <table className="w-full text-xs">
              <thead className="bg-white/[0.03] border-b border-white/[0.06]">
                <tr className="text-[10px] uppercase tracking-wider text-neutral-500">
                  <th className="text-left px-3 py-2 font-medium">Ticker</th>
                  <th className="text-left px-2 py-2 font-medium">Side</th>
                  <th
                    className="text-center px-2 py-2 font-medium"
                    title="Position Health Score 0–100. Combines liquidation buffer, leverage, stop-loss hygiene, funding cost, and PnL trajectory. Hover the badge to see what's dragging it down."
                  >
                    Health
                  </th>
                  <th className="text-right px-2 py-2 font-medium">Size</th>
                  <th className="text-right px-2 py-2 font-medium">Entry</th>
                  <th className="text-right px-2 py-2 font-medium">Mark</th>
                  <th className="text-right px-2 py-2 font-medium">Value</th>
                  <th className="text-right px-2 py-2 font-medium">P&amp;L</th>
                  <th className="text-right px-2 py-2 font-medium">TP</th>
                  <th className="text-right px-2 py-2 font-medium">SL</th>
                  <th className="text-right px-2 py-2 font-medium" title="Cumulative funding paid/received over the life of the position">Σ funding</th>
                  <th
                    className="text-right px-2 py-2 font-medium"
                    title="Projected daily funding cost in USD if the current rate holds. Negative = paying, positive = receiving."
                  >$/day</th>
                  <th className="text-right px-2 py-2 font-medium" title="Current annualised funding APR (most recent snapshot). Sub-line shows the native per-interval rate.">Now</th>
                  <th className="text-right px-2 py-2 font-medium" title="24-hour average funding APR (annualised). Sub-line shows the average native per-interval rate.">24h avg</th>
                  <th className="text-right px-2 py-2 font-medium" title="48-hour average funding APR (annualised). Sub-line shows the average native per-interval rate.">48h avg</th>
                  <th className="text-right px-3 py-2 font-medium">Liq.</th>
                  <th className="text-left px-2 py-2 font-medium">Exchange</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <PositionRow key={p.id} p={p} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ─── Positions: mobile card list ─── */}
        {data && data.positions.length > 0 && (
          <div className="space-y-2 md:hidden">
            {filtered.map(p => (
              <PositionCardMobile key={p.id} p={p} />
            ))}
          </div>
        )}

        {/* Footer note about sync timing */}
        {data && (
          <div className="text-center mt-4 text-[10px] text-neutral-600">
            Last refresh: {new Date(data.ts).toLocaleTimeString()} · sync runs server-side every 60s
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}

// ─── Summary cell ──────────────────────────────────────────────────────

function SummaryCell({
  label, value, sub, valueColor,
}: { label: string; value: string; sub?: string; valueColor?: string }) {
  return (
    <div className="card-premium p-3">
      <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium">{label}</div>
      <div className={`text-lg font-bold tabular-nums mt-0.5 ${valueColor ?? 'text-white'}`}>{value}</div>
      {sub && <div className="text-[9px] text-neutral-600 mt-0.5">{sub}</div>}
    </div>
  );
}

// ─── Single position row ───────────────────────────────────────────────

function PositionRow({ p }: { p: Position }) {
  const pnl = p.unrealizedPnl;
  const pnlClass = pnl === null ? 'text-neutral-500' : pnl >= 0 ? 'text-emerald-400' : 'text-red-400';

  const cur = fundingTone(p.side, p.currentFunding);
  const a24 = fundingTone(p.side, p.avg24hFunding);
  const a48 = fundingTone(p.side, p.avg48hFunding);

  // Annualised projections — give users a 1h-vs-8h-comparable apples view.
  // Direction-aware so a long paying +0.001%/1h shows as a NEGATIVE APR
  // (cost), not the raw exchange rate.
  const intervalH = intervalHoursFor(p.exchange);
  const sideMul = p.side === 'long' ? -1 : 1;
  const aprNow = p.currentFunding != null
    ? annualizeRate(p.currentFunding, intervalH) * sideMul
    : null;
  const apr24 = p.avg24hFunding != null
    ? annualizeRate(p.avg24hFunding, intervalH) * sideMul
    : null;
  const apr48 = p.avg48hFunding != null
    ? annualizeRate(p.avg48hFunding, intervalH) * sideMul
    : null;

  // Tooltip body for Σ funding — clarifies that historical sign can
  // diverge from the current rate when funding flipped during the hold.
  const cumFundingTitle = p.cumulativeFunding == null
    ? 'No cumulative funding data for this exchange yet.'
    : `${p.cumulativeFunding >= 0 ? 'Net received' : 'Net paid'} since position opened. Sign reflects net flow over the entire hold — can differ from the current rate if funding flipped direction during the hold.`;

  return (
    <tr className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
      <td className="px-3 py-2 font-semibold text-white">{p.symbol}</td>
      <td className="px-2 py-2">
        {p.side === 'long' ? (
          <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-emerald-400">
            <ArrowUpRight className="w-3 h-3" /> Long
          </span>
        ) : (
          <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-red-400">
            <ArrowDownRight className="w-3 h-3" /> Short
          </span>
        )}
      </td>
      <td className="px-2 py-2 text-center">
        <HealthBadge
          score={p.healthScore}
          label={p.healthLabel}
          reasons={p.healthReasons}
        />
      </td>
      <td className="px-2 py-2 text-right tabular-nums text-neutral-300">{fmtSize(p.size)}</td>
      <td className="px-2 py-2 text-right tabular-nums text-neutral-300">{fmtPrice(p.entryPrice)}</td>
      <td className="px-2 py-2 text-right tabular-nums text-neutral-300">{fmtPrice(p.markPrice)}</td>
      <td className="px-2 py-2 text-right tabular-nums text-white font-medium">{fmtUsd(p.positionValue)}</td>
      <td className={`px-2 py-2 text-right tabular-nums font-medium ${pnlClass}`}>
        {fmtUsd(pnl, { sign: true })}
      </td>
      <td className="px-2 py-2 text-right tabular-nums text-neutral-500">{fmtPrice(p.tpPrice)}</td>
      <td className="px-2 py-2 text-right tabular-nums text-neutral-500">{fmtPrice(p.slPrice)}</td>
      <td
        className={`px-2 py-2 text-right tabular-nums ${
          p.cumulativeFunding === null
            ? (p.dailyFundingCarryUsd == null ? 'text-neutral-600' : (p.dailyFundingCarryUsd >= 0 ? 'text-emerald-400/70' : 'text-red-400/70'))
            : (p.cumulativeFunding >= 0 ? 'text-emerald-400' : 'text-red-400')
        }`}
        title={
          p.cumulativeFunding === null
            ? (p.dailyFundingCarryUsd == null
                ? `${p.exchange} doesn't expose cumulative funding via API yet — only the live rate is available.`
                : `${p.exchange} doesn't expose cumulative funding directly. Showing the projected daily ${p.dailyFundingCarryUsd >= 0 ? 'received' : 'paid'} (≈ ${fmtUsd(p.dailyFundingCarryUsd * 30, { sign: true })}/mo) at the current rate.`)
            : cumFundingTitle
        }
      >
        {p.cumulativeFunding !== null
          ? fmtUsd(p.cumulativeFunding, { sign: true })
          : (p.dailyFundingCarryUsd == null
              ? '—'
              : <span className="opacity-80">≈ {fmtUsd(p.dailyFundingCarryUsd, { sign: true })}/d</span>)}
      </td>
      <td
        className={`px-2 py-2 text-right tabular-nums ${
          p.dailyFundingCarryUsd == null ? 'text-neutral-600' :
          p.dailyFundingCarryUsd >= 0 ? 'text-emerald-400' : 'text-red-400'
        }`}
        title={p.dailyFundingCarryUsd == null
          ? 'No live funding rate available — projection unavailable.'
          : `Projected daily ${p.dailyFundingCarryUsd >= 0 ? 'received' : 'paid'} at the current rate. ` +
            `Monthly ≈ ${fmtUsd(p.dailyFundingCarryUsd * 30, { sign: true })}.`}
      >
        {p.dailyFundingCarryUsd == null ? '—' : fmtUsd(p.dailyFundingCarryUsd, { sign: true })}
      </td>
      {/* Funding rate columns: annualised APR is the primary number (matches
          how traders + christian's spreadsheet mockup think about cost-of-carry).
          Native per-interval rate dropped to a smaller sub-line so power users
          who want to verify against the venue UI can still see it. */}
      <td
        className={`px-2 py-2 text-right tabular-nums ${TONE_CLASS[cur]}`}
        title={`${fmtApr(aprNow)}% APR · ${fmtPct(p.currentFunding, { sign: true, digits: 4 })} per ${intervalH}h native (${p.side === 'long' ? 'long perspective' : 'short perspective'})`}
      >
        <div className="font-semibold">{fmtApr(aprNow)}%</div>
        <div className={`text-[9px] opacity-60`}>{fmtPct(p.currentFunding, { sign: true, digits: 4 })}/{intervalH}h</div>
      </td>
      <td
        className={`px-2 py-2 text-right tabular-nums ${TONE_CLASS[a24]}`}
        title={`24h avg ${fmtApr(apr24)}% APR · ${fmtPct(p.avg24hFunding, { sign: true, digits: 4 })} per ${intervalH}h native`}
      >
        <div className="font-semibold">{fmtApr(apr24)}%</div>
        <div className={`text-[9px] opacity-60`}>{fmtPct(p.avg24hFunding, { sign: true, digits: 4 })}/{intervalH}h</div>
      </td>
      <td
        className={`px-2 py-2 text-right tabular-nums ${TONE_CLASS[a48]}`}
        title={`48h avg ${fmtApr(apr48)}% APR · ${fmtPct(p.avg48hFunding, { sign: true, digits: 4 })} per ${intervalH}h native`}
      >
        <div className="font-semibold">{fmtApr(apr48)}%</div>
        <div className={`text-[9px] opacity-60`}>{fmtPct(p.avg48hFunding, { sign: true, digits: 4 })}/{intervalH}h</div>
      </td>
      <td className="px-3 py-2 text-right tabular-nums text-amber-400/80 text-[10px]">
        {p.liquidationPrice ? fmtPrice(p.liquidationPrice) : '—'}
      </td>
      <td className="px-2 py-2 text-[11px] text-neutral-500">{p.exchange}</td>
    </tr>
  );
}

// ─── Mobile card (single position, < md breakpoint) ────────────────────
//
// Re-renders the same data as PositionRow but as a stacked card so users
// don't horizontal-scroll through 15 columns on a phone. Prioritizes the
// fields a trader actually checks first: symbol/side/exchange, P&L, the
// three funding context columns. Less-critical (size/entry/TP/SL/Liq)
// gets a smaller secondary grid.

function PositionCardMobile({ p }: { p: Position }) {
  const pnl = p.unrealizedPnl;
  const pnlClass = pnl === null ? 'text-neutral-500' : pnl >= 0 ? 'text-emerald-400' : 'text-red-400';
  const cur = fundingTone(p.side, p.currentFunding);
  const a24 = fundingTone(p.side, p.avg24hFunding);
  const a48 = fundingTone(p.side, p.avg48hFunding);

  const intervalH = intervalHoursFor(p.exchange);
  const sideMul = p.side === 'long' ? -1 : 1;
  const aprNow = p.currentFunding != null ? annualizeRate(p.currentFunding, intervalH) * sideMul : null;
  const apr24 = p.avg24hFunding != null ? annualizeRate(p.avg24hFunding, intervalH) * sideMul : null;
  const apr48 = p.avg48hFunding != null ? annualizeRate(p.avg48hFunding, intervalH) * sideMul : null;
  const cumFundingTitle = p.cumulativeFunding == null
    ? 'No cumulative funding data for this exchange yet.'
    : `${p.cumulativeFunding >= 0 ? 'Net received' : 'Net paid'} since position opened. Sign reflects net flow over the entire hold — can differ from the current rate if funding flipped during the hold.`;

  return (
    <div className="card-premium p-3">
      {/* Header row: symbol + side + exchange + p&l */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base font-bold text-white">{p.symbol}</span>
          {p.side === 'long' ? (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
              <ArrowUpRight className="w-2.5 h-2.5" /> LONG
            </span>
          ) : (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">
              <ArrowDownRight className="w-2.5 h-2.5" /> SHORT
            </span>
          )}
          <span className="text-[10px] text-neutral-500 truncate">{p.exchange}</span>
        </div>
        <div className="flex items-center gap-2">
          <HealthBadge score={p.healthScore} label={p.healthLabel} reasons={p.healthReasons} compact />
          <div className={`text-right tabular-nums font-bold text-sm ${pnlClass}`}>
            {fmtUsd(pnl, { sign: true })}
          </div>
        </div>
      </div>

      {/* Funding row — the killer feature, gets prominent placement.
          Each cell shows native rate AND annualised APR underneath so 1h
          (HL/dYdX) and 8h (Binance/Bybit) venues are apples-to-apples. */}
      <div className="grid grid-cols-3 gap-1 mb-2 text-[10px]">
        {/* Annualised APR primary, native per-interval rate as the small
            sub-line — matches christian's mockup where -11% / -8% / -9%
            funding magnitudes only make sense as APR, not per-interval. */}
        <FundingMini label="Now" primary={`${fmtApr(aprNow)}%`} secondary={`${fmtPct(p.currentFunding, { sign: true, digits: 4 })}/${intervalH}h`} tone={cur} />
        <FundingMini label="24h" primary={`${fmtApr(apr24)}%`} secondary={`${fmtPct(p.avg24hFunding, { sign: true, digits: 4 })}/${intervalH}h`} tone={a24} />
        <FundingMini label="48h" primary={`${fmtApr(apr48)}%`} secondary={`${fmtPct(p.avg48hFunding, { sign: true, digits: 4 })}/${intervalH}h`} tone={a48} />
      </div>

      {/* Secondary grid */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px]">
        <SecondaryRow label="Value" value={fmtUsd(p.positionValue)} />
        <SecondaryRow label="Size" value={fmtSize(p.size)} />
        <SecondaryRow label="Entry" value={fmtPrice(p.entryPrice)} />
        <SecondaryRow label="Mark" value={fmtPrice(p.markPrice)} />
        {p.tpPrice && <SecondaryRow label="TP" value={fmtPrice(p.tpPrice)} valueClass="text-emerald-400" />}
        {p.slPrice && <SecondaryRow label="SL" value={fmtPrice(p.slPrice)} valueClass="text-red-400" />}
        {p.liquidationPrice && <SecondaryRow label="Liq." value={fmtPrice(p.liquidationPrice)} valueClass="text-amber-400" />}
        {p.cumulativeFunding !== null ? (
          <div title={cumFundingTitle} className="contents">
            <SecondaryRow
              label="Σ funding"
              value={fmtUsd(p.cumulativeFunding, { sign: true })}
              valueClass={p.cumulativeFunding >= 0 ? 'text-emerald-400' : 'text-red-400'}
            />
          </div>
        ) : p.dailyFundingCarryUsd != null && (
          // Σ funding unavailable from this venue — show daily projection so
          // users still see whether they're net-paying or net-receiving.
          <div
            title={`${p.exchange} doesn't expose cumulative funding directly. Showing projected daily at the current rate.`}
            className="contents"
          >
            <SecondaryRow
              label="≈ Σ/day"
              value={fmtUsd(p.dailyFundingCarryUsd, { sign: true })}
              valueClass={p.dailyFundingCarryUsd >= 0 ? 'text-emerald-400/80' : 'text-red-400/80'}
            />
          </div>
        )}
        {p.dailyFundingCarryUsd != null && p.cumulativeFunding !== null && (
          <SecondaryRow
            label="$/day"
            value={fmtUsd(p.dailyFundingCarryUsd, { sign: true })}
            valueClass={p.dailyFundingCarryUsd >= 0 ? 'text-emerald-400' : 'text-red-400'}
          />
        )}
      </div>
    </div>
  );
}

function FundingMini({
  label, primary, secondary, tone,
}: {
  label: string;
  /** Bold top number — annualised APR including the % sign. */
  primary: string;
  /** Smaller sub-line — native per-interval rate, e.g. "+0.0019%/8h". */
  secondary?: string;
  tone: 'good' | 'bad' | 'neutral';
}) {
  return (
    <div className="bg-white/[0.02] rounded px-2 py-1.5 text-center">
      <div className="text-[9px] uppercase tracking-wider text-neutral-600 font-medium">{label}</div>
      <div className={`tabular-nums font-mono text-[11px] mt-0.5 font-semibold ${TONE_CLASS[tone]}`}>{primary}</div>
      {secondary && !secondary.startsWith('—') && (
        <div className={`tabular-nums font-mono text-[9px] opacity-60 ${TONE_CLASS[tone]}`}>{secondary}</div>
      )}
    </div>
  );
}

function SecondaryRow({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between border-b border-white/[0.03] py-1 last:border-0">
      <span className="text-neutral-500 text-[10px] uppercase tracking-wider">{label}</span>
      <span className={`tabular-nums font-mono ${valueClass ?? 'text-neutral-200'}`}>{value}</span>
    </div>
  );
}

// ─── Funding carry strip ───────────────────────────────────────────────
// Aggregate net funding cost across the user's whole book. Shown
// underneath the summary cells so users see at a glance whether their
// open positions are net-paying or net-receiving funding RIGHT NOW.
//
// Three projections derived from the same number — daily, monthly,
// annualised. None of these compound (funding doesn't reinvest); they
// just multiply the daily rate. We show all three so traders can pick
// the time-horizon that maps to their thinking.

function FundingCarryStrip({ dailyCarry }: { dailyCarry: number }) {
  const tone = dailyCarry >= 0 ? 'text-emerald-400' : 'text-red-400';
  const bg = dailyCarry >= 0
    ? 'border-emerald-500/20 bg-emerald-500/[0.04]'
    : 'border-red-500/20 bg-red-500/[0.04]';
  const verb = dailyCarry >= 0 ? 'receiving' : 'paying';
  const monthly = dailyCarry * 30;
  const annualised = dailyCarry * 365;
  return (
    <div className={`card-premium ${bg} mb-4 px-3 py-2 flex flex-wrap items-center gap-x-4 gap-y-1`}>
      <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium">
        Funding carry
      </div>
      <div className="text-[11px] text-neutral-400">
        At current rates you are{' '}
        <span className={`font-bold ${tone}`}>{verb}</span>{' '}
        approximately
      </div>
      <div className="flex items-center gap-3 text-[11px] tabular-nums font-mono">
        <span className={`font-bold ${tone}`}>
          {fmtUsd(dailyCarry, { sign: true })}/day
        </span>
        <span className="text-neutral-500">·</span>
        <span className={`${tone} opacity-80`}>
          {fmtUsd(monthly, { sign: true })}/mo
        </span>
        <span className="text-neutral-500">·</span>
        <span className={`${tone} opacity-60`}>
          {fmtUsd(annualised, { sign: true })}/yr
        </span>
      </div>
      <div className="ml-auto text-[9px] text-neutral-600">
        Projection only — assumes the live rate holds.
      </div>
    </div>
  );
}

// ─── Health badge ──────────────────────────────────────────────────────
// Single-glance risk indicator on each position row. Hover shows the
// 1-3 reasons the score is dragged down (or "Position is healthy" when
// nothing's flagged). Color-coded so users can scan a 30-position table
// and immediately see which ones need attention.

// "Vibes" emoji per health label — leans into the screenshot/share-friendly
// format. Used on the badge alongside the numeric score.
const VIBE_EMOJI: Record<'critical' | 'risky' | 'caution' | 'ok' | 'healthy', string> = {
  critical: '🔥',
  risky: '😰',
  caution: '😐',
  ok: '🙂',
  healthy: '😎',
};

function HealthBadge({
  score,
  label,
  reasons,
  compact = false,
}: {
  score: number;
  label: 'critical' | 'risky' | 'caution' | 'ok' | 'healthy';
  reasons: string[];
  compact?: boolean;
}) {
  const tone =
    label === 'critical' ? 'bg-red-500/15 text-red-300 border-red-400/30' :
    label === 'risky'    ? 'bg-orange-500/15 text-orange-300 border-orange-400/30' :
    label === 'caution'  ? 'bg-amber-500/15 text-amber-300 border-amber-400/30' :
    label === 'ok'       ? 'bg-sky-500/15 text-sky-300 border-sky-400/30' :
                           'bg-emerald-500/15 text-emerald-300 border-emerald-400/30';

  const vibe = VIBE_EMOJI[label];

  const title = reasons.length > 0
    ? `${vibe} Health: ${score}/100 (${label})\n• ${reasons.join('\n• ')}`
    : `${vibe} Health: ${score}/100 (${label}) — no concerns`;

  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border tabular-nums font-mono font-bold ${
        compact ? 'text-[10px]' : 'text-[11px]'
      } ${tone}`}
    >
      <span className="text-[12px]" aria-hidden>{vibe}</span>
      {score}
      {!compact && <span className="opacity-60 font-normal text-[9px] uppercase tracking-wider">{label}</span>}
    </span>
  );
}
