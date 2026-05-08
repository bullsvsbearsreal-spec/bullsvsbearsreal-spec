'use client';

/**
 * /whale-liq — Whale Liquidation Roulette
 *
 * Live feed of every Hyperliquid whale position sorted by proximity to
 * liquidation. The Coinglass-killer for "who's about to blow up."
 *
 * Auto-refresh every 60s. Filter chip lets users widen the scan from
 * "danger zone" (within 5%) to "watching" (within 20%). Each row links
 * out to the whale's HL profile + Hypurrscan.
 */
import { useEffect, useState, useCallback, useMemo } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Link from 'next/link';
import { Flame, RefreshCw, ExternalLink, AlertTriangle, TrendingUp, TrendingDown, Filter } from 'lucide-react';

interface WhaleLiqRow {
  address: string;
  label: string;
  accountValue: number;
  exchange: 'Hyperliquid';
  coin: string;
  side: 'long' | 'short';
  size: number;
  positionValue: number;
  markPrice: number;
  liquidationPrice: number;
  distancePct: number;
  unrealizedPnl: number;
  leverage: number;
  allTimePnl?: number;
  allTimeRoi?: number;
}

interface ApiResponse {
  ts: number;
  rows: WhaleLiqRow[];
  scanned: number;
  positionsTotal: number;
  withinFive: number;
  withinTen: number;
  /** True when no whale matched the filter and the API fell back to
   *  showing the top-N closest-to-liq overall. Page should label these
   *  as "closest currently open" not "near liq". */
  belowFilter?: boolean;
  meta: { within: number; limit: number };
}

const fmtUsd = (n: number): string => {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
};
const fmtPct = (n: number, digits = 2) => `${(n * 100).toFixed(digits)}%`;
const fmtPrice = (n: number) => {
  if (n < 0.01) return `$${n.toFixed(6)}`;
  if (n < 1) return `$${n.toFixed(4)}`;
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
};
const truncAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

const PRESETS = [
  { label: '🔥 Danger zone (<2%)', within: 0.02 },
  { label: '🚨 Tight (<5%)',        within: 0.05 },
  { label: '⚠️ Watching (<10%)',     within: 0.10 },
  { label: '👀 Wide (<20%)',         within: 0.20 },
];

function distanceTone(distance: number): string {
  if (distance < 0.02) return 'text-red-300 bg-red-500/15 border-red-400/40';
  if (distance < 0.05) return 'text-orange-300 bg-orange-500/15 border-orange-400/40';
  if (distance < 0.10) return 'text-amber-300 bg-amber-500/15 border-amber-400/40';
  return 'text-sky-300 bg-sky-500/15 border-sky-400/30';
}

function distanceLabel(distance: number): string {
  if (distance < 0.02) return '🔥 critical';
  if (distance < 0.05) return '🚨 tight';
  if (distance < 0.10) return '⚠️ watching';
  return '👀 ok';
}

export default function WhaleLiqRoulettePage() {
  const [within, setWithin] = useState(0.05);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`/api/whale-liq?within=${within}&limit=100`, {
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) {
        setError(`HTTP ${res.status}`);
        return;
      }
      const json = (await res.json()) as ApiResponse;
      setData(json);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      // Symmetric with the conditional setLoading(true) at the top — silent
      // auto-refreshes (every 60s) shouldn't toggle the spinner re-render.
      if (!silent) setLoading(false);
    }
  }, [within]);

  useEffect(() => {
    load(false);
    const id = setInterval(() => load(true), 60_000);
    return () => clearInterval(id);
  }, [load]);

  const longCount = useMemo(() => data?.rows.filter(r => r.side === 'long').length ?? 0, [data]);
  const shortCount = useMemo(() => data?.rows.filter(r => r.side === 'short').length ?? 0, [data]);

  return (
    <>
      <Header />
      <main className="max-w-[1400px] mx-auto px-4 py-6">
        <div className="mb-4 flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-red-400" />
              <h1 className="text-2xl font-bold text-white">Whale Liquidation Roulette</h1>
              <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-400/15 text-red-400 font-bold">
                live
              </span>
            </div>
            <p className="text-sm text-neutral-500 mt-1">
              Hyperliquid whale positions sorted by closest-to-liquidation. Refreshes every 60s.
              Pure spectator sport with embedded alpha — when whales liq, the cascade follows.
            </p>
          </div>
          <button
            onClick={() => load(false)}
            disabled={loading}
            className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-hub-yellow disabled:opacity-40"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> refresh
          </button>
        </div>

        {/* Summary cards */}
        {data && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
            <SummaryCell label="Whales scanned" value={data.scanned.toLocaleString()} />
            <SummaryCell label="Total positions" value={data.positionsTotal.toLocaleString()} />
            <SummaryCell label="Within 5%" value={data.withinFive.toLocaleString()} valueColor="text-red-400" />
            <SummaryCell label="Within 10%" value={data.withinTen.toLocaleString()} valueColor="text-amber-400" />
            <SummaryCell label="Long / Short" value={`${longCount} / ${shortCount}`} />
          </div>
        )}

        {/* Filter chips */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <Filter className="w-3.5 h-3.5 text-neutral-500" />
          {PRESETS.map(p => (
            <button
              key={p.within}
              onClick={() => setWithin(p.within)}
              className={`text-[11px] px-2 py-1 rounded-md font-medium transition-colors ${
                within === p.within
                  ? 'bg-hub-yellow text-black'
                  : 'bg-white/[0.04] text-neutral-400 hover:text-white hover:bg-white/[0.08]'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="card-premium p-4 border border-red-400/30 bg-red-500/5 text-sm text-red-300 mb-4 inline-flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {!data && !error && (
          <div className="card-premium p-8 text-center text-neutral-500 text-sm">Loading roulette wheel…</div>
        )}

        {data && data.rows.length === 0 && (
          <div className="card-premium p-8 text-center text-neutral-500 text-sm">
            No whales within {fmtPct(within)} of liquidation right now. Wide it up to see more.
          </div>
        )}

        {data && data.belowFilter && data.rows.length > 0 && (
          <div className="mb-3 px-3 py-2 rounded-md border border-amber-500/30 bg-amber-500/[0.06] text-[11px] text-amber-200/90 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
            <span>
              No whales within {fmtPct(within, 0)} of liquidation right now —
              showing the {data.rows.length} closest open positions instead.
              Healthy market.
            </span>
          </div>
        )}

        {data && data.rows.length > 0 && (
          <>
            {/* Desktop table */}
            <div className="card-premium overflow-x-auto hidden md:block">
              <table className="w-full text-xs">
                <thead className="bg-white/[0.03] border-b border-white/[0.06]">
                  <tr className="text-[10px] uppercase tracking-wider text-neutral-500">
                    <th className="text-left px-3 py-2 font-medium">#</th>
                    <th className="text-left px-2 py-2 font-medium">Whale</th>
                    <th className="text-left px-2 py-2 font-medium">Coin</th>
                    <th className="text-left px-2 py-2 font-medium">Side</th>
                    <th className="text-right px-2 py-2 font-medium">Position</th>
                    <th className="text-right px-2 py-2 font-medium">Mark</th>
                    <th className="text-right px-2 py-2 font-medium">Liq</th>
                    <th className="text-right px-2 py-2 font-medium">Distance</th>
                    <th className="text-right px-2 py-2 font-medium">Lev</th>
                    <th className="text-right px-2 py-2 font-medium">Open PnL</th>
                    <th className="text-right px-3 py-2 font-medium">Account</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r, i) => (
                    <tr key={`${r.address}-${r.coin}-${r.side}-${i}`} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                      <td className="px-3 py-2 text-neutral-500 tabular-nums">{i + 1}</td>
                      <td className="px-2 py-2">
                        <Link
                          href={`/trader/${r.address}`}
                          className="text-white hover:text-hub-yellow font-mono"
                          title={r.address}
                        >
                          {r.label === r.address || r.label.startsWith('0x') ? truncAddr(r.address) : r.label}
                        </Link>
                      </td>
                      <td className="px-2 py-2 text-white font-semibold">{r.coin}</td>
                      <td className="px-2 py-2">
                        {r.side === 'long' ? (
                          <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-emerald-400">
                            <TrendingUp className="w-3 h-3" /> Long
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-red-400">
                            <TrendingDown className="w-3 h-3" /> Short
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums text-white">{fmtUsd(r.positionValue)}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-neutral-300">{fmtPrice(r.markPrice)}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-amber-400/80">{fmtPrice(r.liquidationPrice)}</td>
                      <td className="px-2 py-2 text-right">
                        <span className={`inline-block tabular-nums font-mono font-bold text-[11px] px-1.5 py-0.5 rounded border ${distanceTone(r.distancePct)}`}>
                          {fmtPct(r.distancePct)}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums text-neutral-300">{r.leverage.toFixed(1)}×</td>
                      <td className={`px-2 py-2 text-right tabular-nums ${r.unrealizedPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {(r.unrealizedPnl >= 0 ? '+' : '') + fmtUsd(r.unrealizedPnl)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-neutral-500">{fmtUsd(r.accountValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="space-y-2 md:hidden">
              {data.rows.map((r, i) => (
                <div key={`${r.address}-${r.coin}-${r.side}-${i}`} className={`card-premium p-3 border ${distanceTone(r.distancePct)}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-base font-bold text-white">{r.coin}</span>
                      {r.side === 'long' ? (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                          <TrendingUp className="w-2.5 h-2.5" /> LONG
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">
                          <TrendingDown className="w-2.5 h-2.5" /> SHORT
                        </span>
                      )}
                    </div>
                    <div className="tabular-nums font-mono font-bold text-base">
                      {fmtPct(r.distancePct)}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px]">
                    <div className="flex justify-between"><span className="text-neutral-500">Position</span><span className="text-white tabular-nums">{fmtUsd(r.positionValue)}</span></div>
                    <div className="flex justify-between"><span className="text-neutral-500">Lev</span><span className="text-white tabular-nums">{r.leverage.toFixed(1)}×</span></div>
                    <div className="flex justify-between"><span className="text-neutral-500">Mark</span><span className="text-white tabular-nums">{fmtPrice(r.markPrice)}</span></div>
                    <div className="flex justify-between"><span className="text-neutral-500">Liq</span><span className="text-amber-400 tabular-nums">{fmtPrice(r.liquidationPrice)}</span></div>
                    <div className="flex justify-between"><span className="text-neutral-500">Account</span><span className="text-white tabular-nums">{fmtUsd(r.accountValue)}</span></div>
                    <div className="flex justify-between"><span className="text-neutral-500">PnL</span><span className={`tabular-nums ${r.unrealizedPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{(r.unrealizedPnl >= 0 ? '+' : '') + fmtUsd(r.unrealizedPnl)}</span></div>
                  </div>
                  <Link href={`/trader/${r.address}`} className="block mt-2 text-[10px] text-hub-yellow hover:underline">
                    {truncAddr(r.address)} <ExternalLink className="inline w-3 h-3 ml-0.5" />
                  </Link>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="text-center mt-4 text-[10px] text-neutral-600">
          {data && (
            <>
              Last refresh: {new Date(data.ts).toLocaleTimeString()} · auto-refreshes every 60s
            </>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}

function SummaryCell({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="card-premium p-3">
      <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium">{label}</div>
      <div className={`text-lg font-bold tabular-nums mt-0.5 ${valueColor ?? 'text-white'}`}>{value}</div>
    </div>
  );
}
