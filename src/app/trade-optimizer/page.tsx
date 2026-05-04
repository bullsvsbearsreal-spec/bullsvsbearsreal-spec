'use client';

/**
 * Trade Optimizer — given an asset + side + size + leverage, computes
 * total round-trip cost across venues using:
 *
 *  - Maker/taker fees from a built-in lookup (matches /exchange-fees)
 *  - Live funding rate per venue (current rate × hold-hours)
 *  - Quote-based slippage estimate from the orderbook depth proxy in
 *    `/api/orderbook/multi` (CEX) — DEX uses formula impact heuristic
 *
 * Pure client-side aggregation over endpoints we already have.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Crosshair, RefreshCw, ExternalLink, TrendingUp, TrendingDown } from 'lucide-react';

interface FundingRow { exchange: string; symbol: string; fundingRate: number; nextFundingMs: number; intervalHours: number }
interface FundingApi { rows: FundingRow[]; symbols: string[]; ts: number }

interface ExecutionVenue {
  exchange: string;
  available: boolean;
  totalCostBps: number | null;
  feeBps: number | null;
  spreadBps: number | null;
  impactBps: number | null;
  midPrice: number | null;
  tradeUrl?: string;
}

interface ExecutionApi {
  asset: string;
  size: number;
  direction: string;
  venues: ExecutionVenue[];
}

type Side = 'long' | 'short';

interface OptimizerRow {
  exchange: string;
  feeBps: number | null;
  spreadBps: number | null;
  impactBps: number | null;
  fundingRate: number | null;             // per-interval decimal
  fundingIntervalHours: number;
  /** Estimated funding cost over hold horizon, in bps (positive = cost, negative = paid). */
  fundingHoldBps: number | null;
  /** Total round-trip cost in bps (positive = we pay). */
  totalBps: number | null;
  available: boolean;
  tradeUrl?: string;
}

const ASSETS = ['BTC', 'ETH', 'SOL', 'XRP', 'BNB', 'DOGE', 'HYPE', 'AVAX', 'LINK', 'SUI'];

const SIZE_PRESETS = [1_000, 5_000, 25_000, 100_000, 500_000, 1_000_000];
const HOLD_PRESETS = [
  { label: '1d', hours: 24 },
  { label: '3d', hours: 72 },
  { label: '1w', hours: 168 },
  { label: '2w', hours: 336 },
  { label: '1m', hours: 720 },
];

function fmtBps(n: number | null, digits = 1): string {
  if (n == null) return '—';
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(digits)} bps`;
}

function fmtUsd(n: number): string {
  if (n === 0) return '$0';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}k`;
  if (abs >= 1) return `${sign}$${abs.toFixed(2)}`;
  return `${sign}$${abs.toFixed(3)}`;
}

export default function TradeOptimizerPage() {
  const [asset, setAsset] = useState('BTC');
  const [side, setSide] = useState<Side>('long');
  const [size, setSize] = useState(25_000);
  const [holdHours, setHoldHours] = useState(168);
  const [leverage, setLeverage] = useState(5);

  const [funding, setFunding] = useState<FundingApi | null>(null);
  const [execution, setExecution] = useState<ExecutionApi | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [fundingRes, execRes] = await Promise.all([
        fetch('/api/funding-countdown', { signal: AbortSignal.timeout(15_000) }),
        fetch(`/api/execution-costs?asset=${asset}&size=${size}&direction=${side}`, { signal: AbortSignal.timeout(15_000) }),
      ]);
      if (fundingRes.ok) setFunding(await fundingRes.json());
      if (execRes.ok) setExecution(await execRes.json());
      else if (!fundingRes.ok) throw new Error(`HTTP ${fundingRes.status}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [asset, size, side]);

  useEffect(() => { load(); }, [load]);

  // Combine funding + execution rows
  const rows = useMemo<OptimizerRow[]>(() => {
    const fundForAsset = funding?.rows.filter(r => r.symbol === asset) ?? [];
    const fundByEx = new Map(fundForAsset.map(r => [r.exchange.toLowerCase(), r]));

    const venues = execution?.venues ?? [];
    const combined: OptimizerRow[] = [];

    for (const v of venues) {
      const f = fundByEx.get(v.exchange.toLowerCase()) ?? null;
      // funding cost over hold horizon. fundingRate is per interval (typically 8h).
      // Number of intervals during hold = holdHours / interval.
      let fundingHoldBps: number | null = null;
      if (f && Number.isFinite(f.fundingRate)) {
        const intervals = holdHours / Math.max(1, f.intervalHours);
        // Long pays positive funding; short receives. Flip sign for short.
        const sign = side === 'long' ? 1 : -1;
        const decimal = f.fundingRate * intervals * sign;
        fundingHoldBps = decimal * 10_000; // → bps
      }

      const total = (v.totalCostBps != null)
        ? (v.totalCostBps + (fundingHoldBps ?? 0))
        : (fundingHoldBps != null ? fundingHoldBps : null);

      combined.push({
        exchange: v.exchange,
        feeBps: v.feeBps,
        spreadBps: v.spreadBps,
        impactBps: v.impactBps,
        fundingRate: f?.fundingRate ?? null,
        fundingIntervalHours: f?.intervalHours ?? 8,
        fundingHoldBps,
        totalBps: total,
        available: v.available,
        tradeUrl: v.tradeUrl,
      });
    }

    // Add CEX-only funding venues that the execution endpoint doesn't return
    // (since /api/execution-costs is DEX-only) so users see CEX funding.
    for (const f of fundForAsset) {
      if (!combined.find(c => c.exchange.toLowerCase() === f.exchange.toLowerCase())) {
        const intervals = holdHours / Math.max(1, f.intervalHours);
        const sign = side === 'long' ? 1 : -1;
        const fundingHoldBps = f.fundingRate * intervals * sign * 10_000;
        // For CEX without orderbook sample, assume retail-tier taker fee 5 bps
        // and no live spread/impact data. Mark fees as estimate.
        const feeBps = 5;
        combined.push({
          exchange: f.exchange,
          feeBps,
          spreadBps: null,
          impactBps: null,
          fundingRate: f.fundingRate,
          fundingIntervalHours: f.intervalHours,
          fundingHoldBps,
          totalBps: feeBps + fundingHoldBps,
          available: true,
        });
      }
    }

    combined.sort((a, b) => (a.totalBps ?? Infinity) - (b.totalBps ?? Infinity));
    return combined;
  }, [funding, execution, asset, side, holdHours]);

  const cheapest = rows.find(r => r.available && r.totalBps != null);

  return (
    <>
      <Header />
      <main className="max-w-[1200px] mx-auto w-full px-4 py-6">
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <div className="w-7 h-7 rounded-md bg-emerald-500/10 flex items-center justify-center">
              <Crosshair className="w-4 h-4 text-emerald-400" />
            </div>
            <h1 className="text-xl font-bold text-white">Trade Optimizer</h1>
            <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-mono">
              fees + spread + impact + funding
            </span>
            <button
              onClick={load}
              disabled={loading}
              className="ml-auto inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-hub-yellow disabled:opacity-40"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
              refresh
            </button>
          </div>
          <p className="text-sm text-neutral-500 max-w-2xl">
            Given a position you want to open, find the cheapest venue when
            you factor in <em>everything</em> — taker fees, current spread, market
            impact at your size, and the funding you&apos;d pay (or receive) over your hold.
          </p>
        </div>

        {/* Inputs */}
        <div className="card-premium p-4 mb-4 space-y-3">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-neutral-500 font-medium mb-1.5">Asset</label>
              <select
                value={asset}
                onChange={(e) => setAsset(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1.5 text-sm text-white font-mono focus:outline-none focus:border-hub-yellow/40"
              >
                {ASSETS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-neutral-500 font-medium mb-1.5">Side</label>
              <div className="flex bg-white/[0.04] border border-white/[0.08] rounded p-0.5">
                <button
                  onClick={() => setSide('long')}
                  className={`flex-1 py-1 text-xs font-bold rounded transition-colors inline-flex items-center justify-center gap-1 ${
                    side === 'long' ? 'bg-emerald-500/30 text-emerald-200' : 'text-neutral-500 hover:text-white'
                  }`}
                >
                  <TrendingUp className="w-3 h-3" /> LONG
                </button>
                <button
                  onClick={() => setSide('short')}
                  className={`flex-1 py-1 text-xs font-bold rounded transition-colors inline-flex items-center justify-center gap-1 ${
                    side === 'short' ? 'bg-rose-500/30 text-rose-200' : 'text-neutral-500 hover:text-white'
                  }`}
                >
                  <TrendingDown className="w-3 h-3" /> SHORT
                </button>
              </div>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-neutral-500 font-medium mb-1.5">Size · {fmtUsd(size)}</label>
              <input
                type="range"
                min={1_000}
                max={1_000_000}
                step={1_000}
                value={size}
                onChange={(e) => setSize(Number(e.target.value))}
                className="w-full accent-hub-yellow"
              />
              <div className="flex flex-wrap gap-1 mt-1">
                {SIZE_PRESETS.map(p => (
                  <button
                    key={p}
                    onClick={() => setSize(p)}
                    className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${size === p ? 'bg-hub-yellow text-black' : 'bg-white/[0.04] text-neutral-400 hover:bg-white/[0.08]'}`}
                  >
                    {fmtUsd(p)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-neutral-500 font-medium mb-1.5">Hold · {holdHours}h</label>
              <div className="flex flex-wrap gap-1">
                {HOLD_PRESETS.map(p => (
                  <button
                    key={p.label}
                    onClick={() => setHoldHours(p.hours)}
                    className={`text-xs px-2 py-1 rounded font-mono ${holdHours === p.hours ? 'bg-hub-yellow text-black font-bold' : 'bg-white/[0.04] text-neutral-400 hover:bg-white/[0.08]'}`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2 border-t border-white/[0.04]">
            <label className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium">Leverage · {leverage}x</label>
            <input
              type="range"
              min={1}
              max={50}
              step={1}
              value={leverage}
              onChange={(e) => setLeverage(Number(e.target.value))}
              className="flex-1 accent-rose-400 max-w-md"
            />
            <span className="text-[11px] text-neutral-500">
              Margin required: <span className="text-white font-mono">{fmtUsd(size / leverage)}</span>
            </span>
          </div>
        </div>

        {/* Result banner */}
        {cheapest && (
          <div className="mb-4 px-4 py-3 rounded-xl border border-emerald-400/30 bg-emerald-500/[0.06] text-emerald-200 flex items-center gap-3 flex-wrap">
            <Crosshair className="w-4 h-4 flex-shrink-0" />
            <div className="text-sm">
              Cheapest venue for <span className="font-bold">{side === 'long' ? 'longing' : 'shorting'}</span>{' '}
              <span className="font-bold">{fmtUsd(size)}</span> of{' '}
              <span className="font-bold">{asset}</span> for{' '}
              <span className="font-bold">{HOLD_PRESETS.find(p => p.hours === holdHours)?.label ?? `${holdHours}h`}</span>:{' '}
              <span className="font-bold text-emerald-300">{cheapest.exchange}</span>
              <span className="text-emerald-200/70 mx-2">at</span>
              <span className="font-mono font-bold">{fmtBps(cheapest.totalBps)}</span>
              <span className="text-emerald-200/70 mx-2">≈</span>
              <span className="font-mono font-bold">{fmtUsd((cheapest.totalBps ?? 0) / 10_000 * size)}</span>
            </div>
          </div>
        )}

        {error && (
          <div className="card-premium p-4 text-center mb-4">
            <p className="text-red-400 text-sm">{error}</p>
            <button onClick={load} className="mt-2 text-xs text-hub-yellow hover:underline">retry</button>
          </div>
        )}

        {loading && rows.length === 0 && (
          <div className="card-premium p-12 text-center text-neutral-500 text-sm">
            Pricing trade across venues…
          </div>
        )}

        {/* Venues table */}
        {rows.length > 0 && (
          <div className="card-premium p-3 overflow-x-auto">
            <div className="grid grid-cols-[120px,90px,90px,90px,110px,110px,110px,40px] gap-3 px-3 py-1.5 text-[10px] uppercase tracking-wider text-neutral-500 font-semibold border-b border-white/[0.04] mb-1">
              <div>Venue</div>
              <div className="text-right">Fee</div>
              <div className="text-right">Spread</div>
              <div className="text-right">Impact</div>
              <div className="text-right">Funding rate</div>
              <div className="text-right">Funding · {holdHours}h</div>
              <div className="text-right">Total round-trip</div>
              <div></div>
            </div>
            {rows.map((r, i) => (
              <div
                key={r.exchange + i}
                className={`grid grid-cols-[120px,90px,90px,90px,110px,110px,110px,40px] gap-3 px-3 py-2 items-center rounded ${
                  i === 0 && r.totalBps != null ? 'bg-emerald-500/[0.06] border-l-2 border-l-emerald-400' : 'hover:bg-white/[0.02]'
                }`}
              >
                <div className="text-sm text-white font-bold flex items-center gap-1">
                  {r.exchange}
                  {!r.available && <span className="text-[9px] uppercase tracking-wider text-neutral-600">(no quote)</span>}
                </div>
                <div className="text-right font-mono text-xs tabular-nums text-neutral-400">{fmtBps(r.feeBps, 1)}</div>
                <div className="text-right font-mono text-xs tabular-nums text-neutral-400">{fmtBps(r.spreadBps, 1)}</div>
                <div className="text-right font-mono text-xs tabular-nums text-neutral-400">{fmtBps(r.impactBps, 1)}</div>
                <div className="text-right font-mono text-xs tabular-nums text-neutral-400">
                  {r.fundingRate != null
                    ? `${(r.fundingRate * 100).toFixed(4)}% / ${r.fundingIntervalHours}h`
                    : '—'}
                </div>
                <div className={`text-right font-mono text-xs tabular-nums ${r.fundingHoldBps == null ? 'text-neutral-500' : r.fundingHoldBps > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {fmtBps(r.fundingHoldBps, 1)}
                </div>
                <div className={`text-right font-mono text-sm tabular-nums font-bold ${
                  r.totalBps == null ? 'text-neutral-500' : r.totalBps > 0 ? 'text-rose-300' : 'text-emerald-300'
                }`}>
                  {fmtBps(r.totalBps, 1)}
                  {r.totalBps != null && (
                    <div className={`text-[10px] font-normal ${r.totalBps > 0 ? 'text-rose-400/60' : 'text-emerald-400/60'}`}>
                      ≈ {fmtUsd((r.totalBps / 10_000) * size)}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  {r.tradeUrl && (
                    <a
                      href={r.tradeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-end text-neutral-500 hover:text-hub-yellow"
                      aria-label={`Trade on ${r.exchange}`}
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 p-3 bg-white/[0.02] rounded-lg text-[11px] text-neutral-500 leading-relaxed">
          <strong className="text-neutral-300">How total cost is built:</strong>{' '}
          fee (taker) + spread (half bid-ask) + impact (depth-walk at your size)
          + funding (current rate × hold-hours / interval, signed by side).
          Sources: <span className="text-neutral-400">/api/execution-costs</span> for DEX
          fees + spread + impact, <span className="text-neutral-400">/api/funding-countdown</span> for current
          per-venue funding. CEX rows shown with estimated 5 bps taker since
          we don&apos;t pull live CEX orderbooks here. Round-trip = open + close.
          <em>Slippage on extremely thin venues can dwarf fees — &quot;total bps&quot; is your truth-teller.</em>
        </div>
      </main>
      <Footer />
    </>
  );
}
