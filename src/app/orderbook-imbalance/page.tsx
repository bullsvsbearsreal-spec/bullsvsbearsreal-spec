'use client';

/**
 * Order Book Imbalance Scanner — surfaces venues where bid/ask depth
 * is currently lopsided. Imbalance = (bidDepth - askDepth) / total.
 * Positive (green) = bids stacked → buy support / squeeze risk.
 * Negative (red) = asks stacked → sell pressure.
 *
 * Reuses /api/orderbook/multi (already deployed) — no new endpoint.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Scale, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';

interface VenueBook {
  exchange: string;
  available: boolean;
  midPrice?: number;
  /** Cumulative USD on bid side within ±X% of mid. */
  bidDepthUsd?: number;
  /** Cumulative USD on ask side within ±X% of mid. */
  askDepthUsd?: number;
  bidCurve?: Array<{ priceOffset: number; cumulativeUsd: number }>;
  askCurve?: Array<{ priceOffset: number; cumulativeUsd: number }>;
}

interface ApiResp {
  asset: string;
  venues: VenueBook[];
}

const ASSETS = ['BTC', 'ETH', 'SOL', 'XRP', 'BNB', 'DOGE', 'HYPE'];
const EXCHANGES = ['Binance', 'Bybit', 'OKX', 'Bitget', 'Hyperliquid', 'dYdX', 'Aster', 'Aevo', 'Lighter'];

interface VenueRow {
  exchange: string;
  midPrice: number;
  bidDepthUsd: number;
  askDepthUsd: number;
  totalDepthUsd: number;
  imbalance: number;          // -1 to +1
  imbalancePct: number;       // -100 to +100
}

function fmtUsd(n: number): string {
  if (!Number.isFinite(n) || n === 0) return '$0';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}k`;
  return `${sign}$${abs.toFixed(0)}`;
}

/** Compute depth at ±X% offset from a curve. Curves are sorted ascending priceOffset. */
function depthAtOffsetPct(curve: Array<{ priceOffset: number; cumulativeUsd: number }> | undefined, pct: number): number {
  if (!curve || curve.length === 0) return 0;
  // priceOffset is decimal (0.005 = 0.5%). Find largest offset ≤ pct.
  const target = Math.abs(pct);
  let bestUsd = 0;
  for (const point of curve) {
    if (Math.abs(point.priceOffset) <= target) {
      if (point.cumulativeUsd > bestUsd) bestUsd = point.cumulativeUsd;
    }
  }
  return bestUsd;
}

export default function OrderbookImbalancePage() {
  const [asset, setAsset] = useState('BTC');
  const [depthPct, setDepthPct] = useState(0.5); // ±0.5% by default
  const [data, setData] = useState<ApiResp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const url = `/api/orderbook/multi?symbol=${asset}&exchanges=${EXCHANGES.join(',')}&depth=true`;
      const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as ApiResp;
      setData(json);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setRefreshing(false);
    }
  }, [asset]);

  useEffect(() => {
    load(false);
    const id = setInterval(() => load(true), 30_000);
    return () => clearInterval(id);
  }, [load]);

  const rows = useMemo<VenueRow[]>(() => {
    if (!data) return [];
    const out: VenueRow[] = [];
    for (const v of data.venues) {
      if (!v.available || !v.midPrice) continue;
      const bid = depthAtOffsetPct(v.bidCurve, depthPct / 100) || v.bidDepthUsd || 0;
      const ask = depthAtOffsetPct(v.askCurve, depthPct / 100) || v.askDepthUsd || 0;
      const total = bid + ask;
      if (total <= 0) continue;
      const imbalance = (bid - ask) / total;
      out.push({
        exchange: v.exchange,
        midPrice: v.midPrice,
        bidDepthUsd: bid,
        askDepthUsd: ask,
        totalDepthUsd: total,
        imbalance,
        imbalancePct: imbalance * 100,
      });
    }
    out.sort((a, b) => Math.abs(b.imbalance) - Math.abs(a.imbalance));
    return out;
  }, [data, depthPct]);

  const aggregateBid = rows.reduce((s, r) => s + r.bidDepthUsd, 0);
  const aggregateAsk = rows.reduce((s, r) => s + r.askDepthUsd, 0);
  const aggregateTotal = aggregateBid + aggregateAsk;
  const aggregateImbalance = aggregateTotal > 0 ? (aggregateBid - aggregateAsk) / aggregateTotal : 0;

  return (
    <>
      <Header />
      <main className="max-w-[1200px] mx-auto w-full px-4 py-6">
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <div className="w-7 h-7 rounded-md bg-cyan-500/10 flex items-center justify-center">
              <Scale className="w-4 h-4 text-cyan-400" />
            </div>
            <h1 className="text-xl font-bold text-white">Orderbook Imbalance</h1>
            <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-mono">
              {rows.length} venues · live
            </span>
            <button
              onClick={() => load(false)}
              disabled={refreshing}
              className="ml-auto inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-hub-yellow disabled:opacity-40"
            >
              <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
              refresh
            </button>
          </div>
          <p className="text-sm text-neutral-500 max-w-2xl">
            Live bid vs ask depth ratio per venue. Positive imbalance (green) =
            buyers stacking limit orders → support / squeeze fuel. Negative
            (red) = sellers stacking → ceiling / impending dump fuel. Window
            is ±N% from mid-price.
          </p>
        </div>

        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <div className="flex items-center gap-1 bg-white/[0.03] rounded-lg p-0.5 overflow-x-auto">
            {ASSETS.map(a => (
              <button
                key={a}
                onClick={() => setAsset(a)}
                className={`px-3 py-1 rounded text-[11px] font-bold uppercase whitespace-nowrap transition-colors ${
                  asset === a ? 'bg-cyan-400 text-black' : 'text-neutral-400 hover:text-white'
                }`}
              >
                {a}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium">Depth band</span>
            <div className="flex bg-white/[0.04] border border-white/[0.08] rounded p-0.5">
              {[0.1, 0.25, 0.5, 1.0, 2.0].map(p => (
                <button
                  key={p}
                  onClick={() => setDepthPct(p)}
                  className={`px-2 py-1 text-[11px] font-mono font-semibold transition-colors ${
                    depthPct === p ? 'bg-cyan-500/30 text-cyan-200 rounded' : 'text-neutral-500 hover:text-white'
                  }`}
                >
                  ±{p}%
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && (
          <div className="card-premium p-4 text-center mb-4">
            <p className="text-red-400 text-sm">Failed to load · {error}</p>
            <button onClick={() => load(false)} className="mt-2 text-xs text-hub-yellow hover:underline">retry</button>
          </div>
        )}

        {!data && !error && (
          <div className="card-premium p-12 text-center text-neutral-500 text-sm">Sampling orderbooks…</div>
        )}

        {/* Aggregate banner */}
        {rows.length > 0 && (
          <div className={`mb-4 px-4 py-3 rounded-xl border flex items-center gap-3 flex-wrap ${
            Math.abs(aggregateImbalance) < 0.05 ? 'border-white/[0.08] bg-white/[0.02] text-neutral-300'
            : aggregateImbalance > 0 ? 'border-emerald-400/30 bg-emerald-500/[0.06] text-emerald-200'
            : 'border-rose-400/30 bg-rose-500/[0.06] text-rose-200'
          }`}>
            {aggregateImbalance > 0.05 ? <TrendingUp className="w-4 h-4" />
              : aggregateImbalance < -0.05 ? <TrendingDown className="w-4 h-4" />
              : <Scale className="w-4 h-4" />}
            <div className="text-sm">
              Aggregate ±{depthPct}% imbalance:{' '}
              <span className="font-bold font-mono">
                {(aggregateImbalance * 100).toFixed(1)}%
              </span>
              <span className="text-neutral-400 mx-2">·</span>
              <span className="text-emerald-300 font-mono font-bold">{fmtUsd(aggregateBid)}</span>
              <span className="text-neutral-500 mx-1">bid</span>
              <span className="text-neutral-500 mx-1">vs</span>
              <span className="text-rose-300 font-mono font-bold">{fmtUsd(aggregateAsk)}</span>
              <span className="text-neutral-500 mx-1">ask</span>
            </div>
          </div>
        )}

        {/* Per-venue table */}
        {rows.length > 0 && (
          <div className="card-premium p-3 overflow-x-auto">
            <div className="grid grid-cols-[120px,90px,110px,110px,110px,1fr] gap-3 px-3 py-1.5 text-[10px] uppercase tracking-wider text-neutral-500 font-semibold border-b border-white/[0.04] mb-1">
              <div>Venue</div>
              <div className="text-right">Mid</div>
              <div className="text-right">Bid depth</div>
              <div className="text-right">Ask depth</div>
              <div className="text-right">Imbalance</div>
              <div>Visualisation</div>
            </div>
            {rows.map(r => {
              const tone = r.imbalance > 0.1 ? 'text-emerald-400 font-bold'
                : r.imbalance > 0.03 ? 'text-emerald-300'
                : r.imbalance > -0.03 ? 'text-neutral-300'
                : r.imbalance > -0.1 ? 'text-rose-300'
                : 'text-rose-400 font-bold';
              const bidPct = (r.bidDepthUsd / r.totalDepthUsd) * 100;
              return (
                <div
                  key={r.exchange}
                  className="grid grid-cols-[120px,90px,110px,110px,110px,1fr] gap-3 px-3 py-2 items-center rounded hover:bg-white/[0.02]"
                >
                  <div className="text-sm text-white font-bold">{r.exchange}</div>
                  <div className="text-right font-mono text-xs tabular-nums text-neutral-400">
                    ${r.midPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-right font-mono text-xs tabular-nums text-emerald-300">{fmtUsd(r.bidDepthUsd)}</div>
                  <div className="text-right font-mono text-xs tabular-nums text-rose-300">{fmtUsd(r.askDepthUsd)}</div>
                  <div className={`text-right font-mono text-sm tabular-nums ${tone}`}>
                    {(r.imbalance * 100).toFixed(1)}%
                  </div>
                  {/* Bar viz: bid green from left, ask red from right, meeting at split */}
                  <div className="h-5 bg-rose-500/10 rounded overflow-hidden relative" title={`${bidPct.toFixed(1)}% bid / ${(100 - bidPct).toFixed(1)}% ask`}>
                    <div
                      className="absolute top-0 bottom-0 left-0 bg-emerald-500/30"
                      style={{ width: `${bidPct}%` }}
                    />
                    <div
                      className="absolute top-0 bottom-0 left-1/2 w-px bg-white/30"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4 p-3 bg-white/[0.02] rounded-lg text-[11px] text-neutral-500 leading-relaxed">
          <strong className="text-neutral-300">How to use:</strong> when one venue
          shows extreme imbalance vs the others, that&apos;s often where flow is
          building. A +20% bid imbalance at Binance with neutral books elsewhere
          can precede a sudden upmove. <strong>Caveat:</strong> resting orders can
          be spoofed; corroborate with /cvd or /orderflow. Updates every 30s.
        </div>
      </main>
      <Footer />
    </>
  );
}
