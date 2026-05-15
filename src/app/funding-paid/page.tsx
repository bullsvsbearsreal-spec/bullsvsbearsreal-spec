'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import PageHero from '@/components/PageHero';
import { TrendingDown, TrendingUp, RefreshCw, DollarSign } from 'lucide-react';

interface CoinFunding {
  symbol: string;
  cumulative30d: number;
  annualized: number;
  avg8h: number;
  windows: number;
  lastTs: number;
}

interface ApiResponse {
  coins: CoinFunding[];
  windowDays: number;
  ts: number;
}

function fmtPct(n: number, digits = 2): string {
  const v = n * 100;
  const sign = v >= 0 ? '+' : '';
  return `${sign}${v.toFixed(digits)}%`;
}

function fmtUsd(n: number): string {
  if (n === 0) return '$0';
  const sign = n >= 0 ? '' : '-';
  const abs = Math.abs(n);
  if (abs >= 1_000) return `${sign}$${abs.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (abs >= 1) return `${sign}$${abs.toFixed(2)}`;
  return `${sign}$${abs.toFixed(3)}`;
}

export default function FundingPaidPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [posSize, setPosSize] = useState<number>(10_000);

  const load = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const res = await fetch('/api/funding-paid', { signal: AbortSignal.timeout(45_000) });
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
    const id = setInterval(() => load(true), 30 * 60_000);
    return () => clearInterval(id);
  }, [load]);

  const sortedAsc = useMemo(() => {
    if (!data) return [];
    return [...data.coins].sort((a, b) => a.cumulative30d - b.cumulative30d);
  }, [data]);

  // Top + bottom
  const topPaid = data?.coins.slice(0, 1)[0];
  const topRebated = sortedAsc[0];

  return (
    <>
      <Header />
      <main className="max-w-[1100px] mx-auto w-full px-4 py-6">
        <PageHero
          icon={DollarSign}
          eyebrow={`Funding · 30d · ${data?.coins.length ?? 0} coins · Binance perps`}
          title="Funding"
          accentNoun="paid"
          accent="red"
          description={
            <>Cumulative funding paid (or rebated) by leveraged longs over the
              past <span className="text-white font-medium">30 days</span>, per coin.
              Positive = longs paid · negative = longs got paid. Annualised
              projection assumes the current rate persists.</>
          }
          actions={
            <button
              onClick={() => load(false)}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-neutral-300 hover:text-white hover:bg-white/[0.08] text-xs font-semibold transition-colors disabled:opacity-40"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          }
        />

        {/* Position size simulator */}
        <div className="card-premium p-3 mb-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium">Simulate</span>
            <span className="text-xs text-neutral-400">If you held a long position of</span>
            <input
              type="number"
              min={100}
              max={1_000_000_000}
              step={1000}
              value={posSize}
              onChange={(e) => setPosSize(Math.max(0, Number(e.target.value) || 0))}
              className="bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1 text-xs font-mono text-white w-32 focus:outline-none focus:border-hub-yellow/40"
            />
            <span className="text-xs text-neutral-400">USD for the past 30 days, you would have paid:</span>
          </div>
        </div>

        {/* Highlights */}
        {data && data.coins.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4">
            {topPaid && (
              <div className="card-premium p-3">
                <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium inline-flex items-center gap-1">
                  <TrendingDown className="w-3 h-3 text-rose-400" /> Most expensive long
                </div>
                <div className="font-mono tabular-nums text-base font-semibold text-white">
                  {topPaid.symbol}
                  <span className="text-neutral-500 mx-2">·</span>
                  <span className="text-rose-400">{fmtPct(topPaid.cumulative30d, 2)}</span>
                </div>
                <div className="text-[11px] text-neutral-500 mt-1">
                  ~{fmtUsd(posSize * topPaid.cumulative30d)} on a {fmtUsd(posSize)} position · {fmtPct(topPaid.annualized, 1)} annualized
                </div>
              </div>
            )}
            {topRebated && topRebated.cumulative30d < 0 && (
              <div className="card-premium p-3">
                <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium inline-flex items-center gap-1">
                  <TrendingUp className="w-3 h-3 text-emerald-400" /> Best long rebate
                </div>
                <div className="font-mono tabular-nums text-base font-semibold text-white">
                  {topRebated.symbol}
                  <span className="text-neutral-500 mx-2">·</span>
                  <span className="text-emerald-400">{fmtPct(topRebated.cumulative30d, 2)}</span>
                </div>
                <div className="text-[11px] text-neutral-500 mt-1">
                  ~{fmtUsd(posSize * topRebated.cumulative30d)} on a {fmtUsd(posSize)} position · {fmtPct(topRebated.annualized, 1)} annualized
                </div>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="card-premium p-4 text-center mb-4">
            <p className="text-red-400 text-sm">Failed to load · {error}</p>
            <button onClick={() => load(false)} className="mt-2 text-xs text-hub-yellow hover:underline">retry</button>
          </div>
        )}

        {!data && !error && (
          <div className="card-premium p-12 text-center text-neutral-500 text-sm">
            Loading 30-day funding history (this can take ~10s)…
          </div>
        )}

        {/* Table */}
        {data && data.coins.length > 0 && (
          <div className="card-premium p-3 overflow-x-auto">
            <div className="grid grid-cols-[40px,90px,120px,120px,120px,120px,1fr] gap-3 px-3 py-1.5 text-[10px] uppercase tracking-wider text-neutral-500 font-semibold border-b border-white/[0.04] mb-1">
              <div>#</div>
              <div>Symbol</div>
              <div className="text-right">30d cum</div>
              <div className="text-right">Annualized</div>
              <div className="text-right">Avg / 8h</div>
              <div className="text-right">Cost / {fmtUsd(posSize)}</div>
              <div className="text-right">Bias</div>
            </div>
            {data.coins.map((c, i) => {
              const longsPaid = c.cumulative30d > 0;
              const cost = posSize * c.cumulative30d;
              const tone = c.cumulative30d > 0.01 ? 'text-rose-400 font-semibold'
                : c.cumulative30d > 0 ? 'text-rose-300'
                : c.cumulative30d < -0.01 ? 'text-emerald-400 font-semibold'
                : 'text-emerald-300';
              const bias = c.cumulative30d > 0.02 ? 'Heavy long pay · perp expensive'
                : c.cumulative30d > 0.005 ? 'Longs paying'
                : c.cumulative30d > -0.005 ? 'Roughly flat'
                : c.cumulative30d > -0.02 ? 'Shorts paying · longs rebated'
                : 'Heavy short pay · longs rebated';
              return (
                <div
                  key={c.symbol}
                  className="grid grid-cols-[40px,90px,120px,120px,120px,120px,1fr] gap-3 px-3 py-2 items-center rounded hover:bg-white/[0.02] transition-colors"
                >
                  <div className="text-right text-neutral-500 font-mono text-xs tabular-nums">{i + 1}</div>
                  <div className="text-sm text-white font-semibold">{c.symbol}</div>
                  <div className={`text-right font-mono text-xs tabular-nums ${tone}`}>
                    {fmtPct(c.cumulative30d, 2)}
                  </div>
                  <div className={`text-right font-mono text-xs tabular-nums ${tone}`}>
                    {fmtPct(c.annualized, 1)}
                  </div>
                  <div className="text-right font-mono text-[11px] tabular-nums text-neutral-400">
                    {fmtPct(c.avg8h, 4)}
                  </div>
                  <div className={`text-right font-mono text-xs tabular-nums ${longsPaid ? 'text-rose-300' : 'text-emerald-300'}`}>
                    {fmtUsd(cost)}
                  </div>
                  <div className="text-right text-[11px] text-neutral-500">{bias}</div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4 p-3 bg-white/[0.02] rounded-lg text-[11px] text-neutral-500 leading-relaxed">
          <strong className="text-neutral-300">How to read:</strong> 30-day cum is the sum of
          all 8-hour funding rates over the past 30 days, expressed as a fraction of position
          size. Positive means longs paid funding (had to pay shorts to keep their position
          open). Annualized = cumulative × (365/30) and assumes today&apos;s pace persists.
          Source: <span className="text-neutral-400">Binance USDT-M Futures `/fapi/v1/fundingRate`</span>.
          Cached 30 minutes. <em>For a real position you&apos;d also pay opening fees + closing fees + spread.</em>
        </div>
      </main>
      <Footer />
    </>
  );
}
