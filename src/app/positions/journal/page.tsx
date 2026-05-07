'use client';

/**
 * /positions/journal — Trade Journal / Wallet Replay
 *
 * Cross-venue trade history with cumulative PnL chart, win rate, fees,
 * per-symbol + per-exchange breakdowns. All scoped to the logged-in user's
 * connected wallets/keys.
 *
 * Currently powered by the user_trades table; HL is wired live, others
 * (Binance/Bybit/etc.) coming as the trade-history sync expands.
 */
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { ArrowLeft, BookOpen, TrendingUp, TrendingDown, RefreshCw, Filter, ExternalLink } from 'lucide-react';

interface TradeRow {
  id: string;
  exchange: string;
  symbol: string;
  side: string;
  direction: 'open' | 'close' | 'reduce' | 'add' | null;
  size: number;
  price: number;
  valueUsd: number;
  feeUsd: number | null;
  realizedPnlUsd: number | null;
  ts: string;
}

interface Stats {
  totalTrades: number;
  closingTrades: number;
  realisedPnlAllTime: number;
  realisedPnlLast30d: number;
  realisedPnlLast7d: number;
  realisedPnlLast24h: number;
  feesPaidAllTime: number;
  winRatePct: number | null;
  largestWin: number;
  largestLoss: number;
  bySymbol: Array<{ symbol: string; realised: number; trades: number }>;
  byExchange: Array<{ exchange: string; realised: number; trades: number }>;
}

interface DailyPoint { date: string; realised: number; cumulative: number }

interface ApiResponse {
  success: boolean;
  trades: TradeRow[];
  stats: Stats;
  series: DailyPoint[];
}

const fmtUsd = (n: number | null | undefined): string => {
  if (n == null || !Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(2)}`;
};
const fmtUsdSign = (n: number | null | undefined): string => {
  if (n == null || !Number.isFinite(n)) return '—';
  return (n >= 0 ? '+' : '') + fmtUsd(n);
};
const fmtPrice = (n: number) => {
  if (n < 0.01) return `$${n.toFixed(6)}`;
  if (n < 1) return `$${n.toFixed(4)}`;
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
};
const fmtSize = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 4 });
const fmtRel = (iso: string): string => {
  const ms = Date.now() - new Date(iso).getTime();
  const m = ms / 60_000;
  if (m < 60) return `${Math.round(m)}m ago`;
  const h = m / 60;
  if (h < 24) return `${Math.round(h)}h ago`;
  const d = h / 24;
  if (d < 30) return `${Math.round(d)}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export default function JournalPage() {
  const router = useRouter();
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exchangeFilter, setExchangeFilter] = useState<string>('');
  const [symbolFilter, setSymbolFilter] = useState<string>('');

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (exchangeFilter) params.set('exchange', exchangeFilter);
      if (symbolFilter) params.set('symbol', symbolFilter);
      const res = await fetch(`/api/account/trades?${params.toString()}`, {
        signal: AbortSignal.timeout(20_000),
      });
      if (res.status === 401) {
        router.push('/auth/signin?callbackUrl=/positions/journal');
        return;
      }
      if (!res.ok) {
        setError(`HTTP ${res.status}`);
        return;
      }
      setData(await res.json());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [exchangeFilter, symbolFilter]);

  const exchangeOptions = useMemo(() => {
    if (!data) return [];
    return Array.from(new Set(data.trades.map(t => t.exchange))).sort();
  }, [data]);

  const symbolOptions = useMemo(() => {
    if (!data) return [];
    return Array.from(new Set(data.trades.map(t => t.symbol))).sort();
  }, [data]);

  const stats = data?.stats;
  const trades = data?.trades ?? [];
  const series = data?.series ?? [];

  const groupedByDay = useMemo(() => {
    const buckets = new Map<string, TradeRow[]>();
    for (const t of trades) {
      const day = new Date(t.ts).toISOString().slice(0, 10);
      const arr = buckets.get(day) ?? [];
      arr.push(t);
      buckets.set(day, arr);
    }
    return Array.from(buckets.entries()).sort(([a], [b]) => b.localeCompare(a));
  }, [trades]);

  // Mini cumulative-PnL chart: SVG path over the daily series. Auto-scales
  // to fit; no chart library dependency.
  const chartPath = useMemo(() => {
    if (series.length === 0) return null;
    const w = 600, h = 100;
    const xs = series.map((_, i) => (i / Math.max(1, series.length - 1)) * w);
    const ys = series.map(s => s.cumulative);
    const yMin = Math.min(0, ...ys);
    const yMax = Math.max(0, ...ys);
    const yRange = yMax - yMin || 1;
    const path = series.map((s, i) => {
      const y = h - ((s.cumulative - yMin) / yRange) * h;
      return `${i === 0 ? 'M' : 'L'}${xs[i].toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    const zeroY = h - ((0 - yMin) / yRange) * h;
    const lastVal = series[series.length - 1].cumulative;
    const tone = lastVal >= 0 ? 'stroke-emerald-400' : 'stroke-red-400';
    return { path, w, h, zeroY, tone, lastVal, yMin, yMax };
  }, [series]);

  return (
    <>
      <Header />
      <main className="max-w-[1400px] mx-auto px-4 py-6">
        <div className="mb-6">
          <Link href="/positions" className="text-[11px] text-neutral-500 hover:text-hub-yellow inline-flex items-center gap-1 mb-2">
            <ArrowLeft className="w-3 h-3" /> back to positions
          </Link>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-hub-yellow" />
                <h1 className="text-2xl font-bold text-white">Trade Journal</h1>
                <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-hub-yellow/15 text-hub-yellow font-bold">
                  beta
                </span>
              </div>
              <p className="text-sm text-neutral-500 mt-1">
                Every closed trade across your connected wallets and keys, with realised PnL,
                win rate, and a 90-day cumulative chart. Live for Hyperliquid, Binance, Bybit,
                and OKX. More venues coming as their clients gain trade-history support.
              </p>
            </div>
            <button
              onClick={load}
              disabled={loading}
              className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-hub-yellow disabled:opacity-40"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="card-premium p-4 border border-red-400/30 bg-red-500/5 text-sm text-red-300 mb-4">
            {error}
          </div>
        )}

        {/* Stats row */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 mb-4">
            <StatCell label="Realised (all time)" value={fmtUsdSign(stats.realisedPnlAllTime)} valueColor={stats.realisedPnlAllTime >= 0 ? 'text-emerald-400' : 'text-red-400'} />
            <StatCell label="30d" value={fmtUsdSign(stats.realisedPnlLast30d)} valueColor={stats.realisedPnlLast30d >= 0 ? 'text-emerald-400' : 'text-red-400'} />
            <StatCell label="7d" value={fmtUsdSign(stats.realisedPnlLast7d)} valueColor={stats.realisedPnlLast7d >= 0 ? 'text-emerald-400' : 'text-red-400'} />
            <StatCell label="24h" value={fmtUsdSign(stats.realisedPnlLast24h)} valueColor={stats.realisedPnlLast24h >= 0 ? 'text-emerald-400' : 'text-red-400'} />
            <StatCell label="Win rate" value={stats.winRatePct == null ? '—' : `${stats.winRatePct.toFixed(1)}%`} sub={`${stats.closingTrades} closes`} />
            <StatCell label="Fees paid" value={fmtUsd(stats.feesPaidAllTime)} valueColor="text-amber-400/80" />
          </div>
        )}

        {/* Cumulative PnL chart (SVG, no deps) */}
        {chartPath && (
          <div className="card-premium p-4 mb-4">
            <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium mb-2">
              Cumulative realised PnL — last {series.length} days
            </div>
            <svg viewBox={`0 0 ${chartPath.w} ${chartPath.h}`} className="w-full h-24">
              {/* Zero baseline */}
              <line x1={0} x2={chartPath.w} y1={chartPath.zeroY} y2={chartPath.zeroY} className="stroke-neutral-700" strokeDasharray="2 4" strokeWidth={0.5} />
              {/* PnL curve */}
              <path d={chartPath.path} className={`fill-none ${chartPath.tone}`} strokeWidth={1.5} strokeLinejoin="round" />
            </svg>
            <div className="flex justify-between text-[10px] text-neutral-500 mt-1 tabular-nums">
              <span>min: {fmtUsd(chartPath.yMin)}</span>
              <span className={chartPath.lastVal >= 0 ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                Now: {fmtUsdSign(chartPath.lastVal)}
              </span>
              <span>max: {fmtUsd(chartPath.yMax)}</span>
            </div>
          </div>
        )}

        {/* Filter chips */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <Filter className="w-3.5 h-3.5 text-neutral-500" />
          <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium mr-1">filter</span>
          <select
            value={exchangeFilter}
            onChange={e => setExchangeFilter(e.target.value)}
            className="bg-white/[0.04] border border-white/10 rounded text-[11px] px-2 py-1 text-neutral-300"
          >
            <option value="">All exchanges</option>
            {exchangeOptions.map(ex => <option key={ex} value={ex}>{ex}</option>)}
          </select>
          <select
            value={symbolFilter}
            onChange={e => setSymbolFilter(e.target.value)}
            className="bg-white/[0.04] border border-white/10 rounded text-[11px] px-2 py-1 text-neutral-300"
          >
            <option value="">All symbols</option>
            {symbolOptions.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* Per-symbol + per-exchange breakdown */}
        {stats && (stats.bySymbol.length > 0 || stats.byExchange.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4">
            {stats.bySymbol.length > 0 && (
              <BreakdownCard title="By symbol (top 20)" rows={stats.bySymbol.map(r => ({ name: r.symbol, realised: r.realised, count: r.trades }))} />
            )}
            {stats.byExchange.length > 0 && (
              <BreakdownCard title="By exchange" rows={stats.byExchange.map(r => ({ name: r.exchange, realised: r.realised, count: r.trades }))} />
            )}
          </div>
        )}

        {!data && !error && (
          <div className="card-premium p-8 text-center text-neutral-500 text-sm">Loading journal…</div>
        )}

        {data && trades.length === 0 && (
          <div className="card-premium p-8 text-center text-neutral-500 text-sm">
            No trades yet. Connect a Hyperliquid wallet from{' '}
            <Link href="/account/connections" className="text-hub-yellow hover:underline">connections</Link>{' '}
            and we&rsquo;ll start syncing your fills on the next cron tick.
          </div>
        )}

        {/* Trade list grouped by day */}
        {groupedByDay.map(([day, dayTrades]) => {
          const dayPnl = dayTrades.reduce((s, t) => s + (t.realizedPnlUsd ?? 0), 0);
          return (
            <div key={day} className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium">
                  {new Date(day).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                </h3>
                <span className={`text-[11px] tabular-nums ${dayPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {fmtUsdSign(dayPnl)}
                </span>
              </div>
              <div className="card-premium overflow-x-auto hidden md:block">
                <table className="w-full text-xs">
                  <thead className="bg-white/[0.03] border-b border-white/[0.06]">
                    <tr className="text-[10px] uppercase tracking-wider text-neutral-500">
                      <th className="text-left px-3 py-2 font-medium">Time</th>
                      <th className="text-left px-2 py-2 font-medium">Exchange</th>
                      <th className="text-left px-2 py-2 font-medium">Symbol</th>
                      <th className="text-left px-2 py-2 font-medium">Side</th>
                      <th className="text-right px-2 py-2 font-medium">Size</th>
                      <th className="text-right px-2 py-2 font-medium">Price</th>
                      <th className="text-right px-2 py-2 font-medium">Value</th>
                      <th className="text-right px-2 py-2 font-medium">Fee</th>
                      <th className="text-right px-3 py-2 font-medium">Realised PnL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dayTrades.map(t => (
                      <TradeRow key={t.id} t={t} />
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="md:hidden space-y-1">
                {dayTrades.map(t => <TradeCardMobile key={t.id} t={t} />)}
              </div>
            </div>
          );
        })}
      </main>
      <Footer />
    </>
  );
}

function StatCell({ label, value, sub, valueColor }: { label: string; value: string; sub?: string; valueColor?: string }) {
  return (
    <div className="card-premium p-3">
      <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium">{label}</div>
      <div className={`text-lg font-bold tabular-nums mt-0.5 ${valueColor ?? 'text-white'}`}>{value}</div>
      {sub && <div className="text-[9px] text-neutral-600 mt-0.5">{sub}</div>}
    </div>
  );
}

function BreakdownCard({ title, rows }: { title: string; rows: Array<{ name: string; realised: number; count: number }> }) {
  const top = rows.slice(0, 8);
  return (
    <div className="card-premium p-3">
      <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium mb-2">{title}</div>
      <div className="space-y-0.5 text-[11px]">
        {top.map(r => (
          <div key={r.name} className="flex items-center justify-between">
            <span className="text-white">{r.name} <span className="text-neutral-600">({r.count})</span></span>
            <span className={`tabular-nums font-mono ${r.realised >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {fmtUsdSign(r.realised)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TradeRow({ t }: { t: TradeRow }) {
  const isBuy = t.side === 'buy' || t.side === 'B';
  const pnlClass = t.realizedPnlUsd == null ? 'text-neutral-600' : t.realizedPnlUsd >= 0 ? 'text-emerald-400' : 'text-red-400';
  return (
    <tr className="border-b border-white/[0.03] hover:bg-white/[0.02]">
      <td className="px-3 py-2 text-neutral-500 text-[11px] whitespace-nowrap">
        {new Date(t.ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
      </td>
      <td className="px-2 py-2 text-[11px] text-neutral-400">{t.exchange}</td>
      <td className="px-2 py-2 font-semibold text-white">{t.symbol}</td>
      <td className="px-2 py-2">
        <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold ${isBuy ? 'text-emerald-400' : 'text-red-400'}`}>
          {isBuy ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
          {isBuy ? 'Buy' : 'Sell'}
          {t.direction && <span className="ml-1 text-[9px] opacity-60 uppercase tracking-wider">{t.direction}</span>}
        </span>
      </td>
      <td className="px-2 py-2 text-right tabular-nums text-neutral-300">{fmtSize(t.size)}</td>
      <td className="px-2 py-2 text-right tabular-nums text-neutral-300">{fmtPrice(t.price)}</td>
      <td className="px-2 py-2 text-right tabular-nums text-white">{fmtUsd(t.valueUsd)}</td>
      <td className="px-2 py-2 text-right tabular-nums text-amber-400/70 text-[11px]">{t.feeUsd != null ? fmtUsd(t.feeUsd) : '—'}</td>
      <td className={`px-3 py-2 text-right tabular-nums font-medium ${pnlClass}`}>
        {t.realizedPnlUsd != null ? fmtUsdSign(t.realizedPnlUsd) : '—'}
      </td>
    </tr>
  );
}

function TradeCardMobile({ t }: { t: TradeRow }) {
  const isBuy = t.side === 'buy' || t.side === 'B';
  return (
    <div className="card-premium p-2">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-white">{t.symbol}</span>
          <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold ${isBuy ? 'text-emerald-400' : 'text-red-400'}`}>
            {isBuy ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
            {isBuy ? 'Buy' : 'Sell'}
            {t.direction && <span className="ml-1 text-[9px] opacity-60 uppercase tracking-wider">{t.direction}</span>}
          </span>
        </div>
        <span className="text-[10px] text-neutral-500">{fmtRel(t.ts)}</span>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px]">
        <div className="flex justify-between"><span className="text-neutral-500">Size</span><span className="text-white tabular-nums">{fmtSize(t.size)}</span></div>
        <div className="flex justify-between"><span className="text-neutral-500">Price</span><span className="text-white tabular-nums">{fmtPrice(t.price)}</span></div>
        <div className="flex justify-between"><span className="text-neutral-500">Value</span><span className="text-white tabular-nums">{fmtUsd(t.valueUsd)}</span></div>
        <div className="flex justify-between"><span className="text-neutral-500">Fee</span><span className="text-amber-400/70 tabular-nums">{t.feeUsd != null ? fmtUsd(t.feeUsd) : '—'}</span></div>
        {t.realizedPnlUsd != null && (
          <div className="flex justify-between col-span-2 border-t border-white/[0.03] pt-1 mt-1">
            <span className="text-neutral-500">Realised</span>
            <span className={`tabular-nums font-mono font-semibold ${t.realizedPnlUsd >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {fmtUsdSign(t.realizedPnlUsd)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
