'use client';

import { useState, useEffect, useCallback } from 'react';
import Header from '@/components/Header';
import PageHero from '@/components/PageHero';
import Footer from '@/components/Footer';
import { LineChart, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';

interface BasisRow {
  asset: 'BTC' | 'ETH';
  spot: number;
  cmeFront: number;
  daysToExpiry: number;
  basisPct: number;
  annualizedPct: number;
  cmeSource: string;
  spotSource: string;
}

interface ApiResponse {
  rows: BasisRow[];
  ts: number;
}

function fmtUsd(n: number): string {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function fmtPct(n: number, digits = 2): string {
  const v = n * 100;
  const sign = v >= 0 ? '+' : '';
  return `${sign}${v.toFixed(digits)}%`;
}

function regimeLabel(annualized: number): { label: string; tone: string } {
  if (annualized > 0.15) return { label: 'Hot · risk-on', tone: 'text-rose-300 bg-rose-500/[0.06] border-rose-400/20' };
  if (annualized > 0.06) return { label: 'Healthy contango', tone: 'text-emerald-300 bg-emerald-500/[0.06] border-emerald-400/20' };
  if (annualized > 0.01) return { label: 'Mild contango', tone: 'text-emerald-200 bg-emerald-500/[0.04] border-emerald-400/15' };
  if (annualized > -0.01) return { label: 'Flat / neutral', tone: 'text-neutral-300 bg-white/[0.04] border-white/[0.08]' };
  return { label: 'Backwardation · fear', tone: 'text-rose-400 bg-rose-500/[0.08] border-rose-400/30' };
}

export default function CmeBasisPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const res = await fetch('/api/cme-basis', { signal: AbortSignal.timeout(15_000) });
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
    const id = setInterval(() => load(true), 5 * 60_000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <>
      <Header />
      <main className="max-w-[1100px] mx-auto w-full px-4 py-6">
        <PageHero
          icon={LineChart}
          eyebrow="Institutional · futures vs spot"
          title="CME"
          accentNoun="basis"
          accent="violet"
          description={
            <>CME front-month BTC and ETH futures premium vs spot, annualized
              to expiry. The basis = the implied cash-and-carry rate
              institutional arbitrageurs can earn by being long spot and short
              futures. Hot basis (<span className="text-white font-medium">&gt;15% APR</span>)
              marks risk-on regimes; backwardation often marks lows.
            </>
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

        {error && (
          <div className="card-premium p-4 text-center mb-4">
            <p className="text-red-400 text-sm">Failed to load · {error}</p>
            <button onClick={() => load(false)} className="mt-2 text-xs text-hub-yellow hover:underline">retry</button>
          </div>
        )}

        {!data && !error && (
          <div className="card-premium p-12 text-center text-neutral-500 text-sm">Loading basis…</div>
        )}

        {data && data.rows.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.rows.map(r => {
              const regime = regimeLabel(r.annualizedPct);
              const isContango = r.basisPct >= 0;
              return (
                <div key={r.asset} className="card-premium p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-2xl font-bold text-white">{r.asset}</h2>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full border ${regime.tone}`}>
                      {regime.label}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Spot</div>
                      <div className="font-mono text-base font-bold text-white">{fmtUsd(r.spot)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">CME front</div>
                      <div className="font-mono text-base font-bold text-white">{fmtUsd(r.cmeFront)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Basis</div>
                      <div className={`font-mono text-base font-bold inline-flex items-center gap-1 ${isContango ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isContango ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {fmtPct(r.basisPct, 2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Annualized</div>
                      <div className={`font-mono text-base font-bold ${r.annualizedPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {fmtPct(r.annualizedPct, 1)}
                      </div>
                    </div>
                  </div>
                  <div className="text-[10px] text-neutral-600 font-mono">
                    {r.daysToExpiry}d to expiry · {r.cmeSource} / {r.spotSource}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4 p-3 bg-white/[0.02] rounded-lg text-[11px] text-neutral-500 leading-relaxed">
          <strong className="text-neutral-300">How to read:</strong> a +10% annualized
          basis means an arbitrageur could earn ~10% APR by buying spot and
          shorting CME futures (cash-and-carry). When this rate is high, retail
          on Binance/Bybit perps is also paying high funding — sentiment is
          frothy. Backwardation (negative basis) is rare and usually marks the
          aftermath of a liquidation cascade. Days-to-expiry is approximated to
          the next CME monthly roll (last Friday). Source: Yahoo Finance front-month
          futures + CoinGecko spot.
        </div>
      </main>
      <Footer />
    </>
  );
}
