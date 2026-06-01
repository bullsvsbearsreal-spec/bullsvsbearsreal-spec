'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import PageHero from '@/components/PageHero';
import { Building2, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';

interface StockRow {
  ticker: string;
  name: string;
  category: 'exchange' | 'miner' | 'treasury' | 'etf' | 'broker' | 'infra';
  price: number | null;
  change24h: number | null;
  return90d: number | null;
  correlationToBtc: number | null;
  betaToBtc: number | null;
}

interface ApiResponse {
  rows: StockRow[];
  windowDays: number;
  btc: { price: number | null; return90d: number | null };
  ts: number;
}

const CATEGORY_LABELS: Record<StockRow['category'], string> = {
  exchange: 'Exchange',
  broker: 'Broker',
  miner: 'Miner',
  treasury: 'Treasury',
  etf: 'ETF',
  infra: 'Infra',
};

const CATEGORY_COLORS: Record<StockRow['category'], string> = {
  exchange: 'bg-cyan-500/10 text-cyan-400 border-cyan-400/20',
  broker: 'bg-blue-500/10 text-blue-400 border-blue-400/20',
  miner: 'bg-orange-500/10 text-orange-400 border-orange-400/20',
  treasury: 'bg-amber-500/10 text-amber-400 border-amber-400/20',
  etf: 'bg-violet-500/10 text-violet-400 border-violet-400/20',
  infra: 'bg-emerald-500/10 text-emerald-400 border-emerald-400/20',
};

function fmtUsd(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return '—';
  if (n >= 1000) return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (n >= 10) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(3)}`;
}

function fmtPct(n: number | null, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return '—';
  const v = n * 100;
  const sign = v >= 0 ? '+' : '';
  return `${sign}${v.toFixed(digits)}%`;
}

function fmtBeta(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return n.toFixed(2);
}

function corrColor(c: number | null): string {
  if (c == null) return 'text-neutral-500';
  if (c > 0.7) return 'text-emerald-400 font-semibold';
  if (c > 0.4) return 'text-emerald-300';
  if (c > 0) return 'text-neutral-300';
  if (c > -0.3) return 'text-amber-300';
  return 'text-rose-400';
}

type Sort = 'return' | 'corr' | 'beta' | 'change' | 'name';
type Filter = 'all' | StockRow['category'];

export default function CryptoStocksPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sort, setSort] = useState<Sort>('return');
  const [filter, setFilter] = useState<Filter>('all');

  const load = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const res = await fetch('/api/crypto-stocks', { signal: AbortSignal.timeout(20_000) });
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
    const id = setInterval(() => load(true), 2 * 60_000);
    return () => clearInterval(id);
  }, [load]);

  const filtered = useMemo(() => {
    if (!data) return [];
    let arr = data.rows;
    if (filter !== 'all') arr = arr.filter(r => r.category === filter);
    arr = [...arr];
    if (sort === 'return') arr.sort((a, b) => (b.return90d ?? -999) - (a.return90d ?? -999));
    else if (sort === 'corr') arr.sort((a, b) => (b.correlationToBtc ?? -999) - (a.correlationToBtc ?? -999));
    else if (sort === 'beta') arr.sort((a, b) => (b.betaToBtc ?? -999) - (a.betaToBtc ?? -999));
    else if (sort === 'change') arr.sort((a, b) => (b.change24h ?? -999) - (a.change24h ?? -999));
    else arr.sort((a, b) => a.ticker.localeCompare(b.ticker));
    return arr;
  }, [data, sort, filter]);

  return (
    <>
      <Header />
      <main className="max-w-[1300px] mx-auto w-full px-4 py-6">
        <PageHero
          icon={Building2}
          eyebrow={`Equities · ${data?.rows.length ?? 0} tickers · 90d window`}
          title="Crypto"
          accentNoun="stocks"
          accent="cyan"
          description={
            <>Crypto-related equities — exchanges, miners, treasury companies,
              spot ETFs, brokers — vs BTC over the past 90 days. Beta = how
              much the stock moves per 1.0 BTC move. Correlation = direction-only
              fit. Many traders use these as leveraged BTC proxies.</>
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

        {/* BTC reference banner */}
        {data && data.btc.price != null && (
          <div className="card-premium p-3 mb-4 flex items-center gap-3 flex-wrap">
            <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium">Reference</span>
            <span className="text-sm text-white font-bold">BTC</span>
            <span className="font-mono text-sm text-white">{fmtUsd(data.btc.price)}</span>
            <span className="text-neutral-600">·</span>
            <span className={`font-mono text-xs ${(data.btc.return90d ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {fmtPct(data.btc.return90d)} 90d
            </span>
          </div>
        )}

        {/* Filters + sort */}
        <div className="flex flex-col md:flex-row md:items-center gap-3 mb-3">
          <div className="flex items-center gap-1 bg-white/[0.03] rounded-lg p-0.5 w-fit overflow-x-auto">
            {([
              ['all', 'All'],
              ['exchange', 'Exchanges'],
              ['miner', 'Miners'],
              ['treasury', 'Treasuries'],
              ['etf', 'ETFs'],
              ['broker', 'Brokers'],
            ] as const).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setFilter(k as Filter)}
                className={`px-3 py-1 rounded text-[11px] font-semibold uppercase whitespace-nowrap transition-colors ${
                  filter === k ? 'bg-cyan-400 text-black' : 'text-neutral-400 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 bg-white/[0.03] rounded-lg p-0.5 w-fit overflow-x-auto md:ml-auto">
            {([
              ['return', '90d ↓'],
              ['change', '24h ↓'],
              ['corr', 'Corr ↓'],
              ['beta', 'Beta ↓'],
              ['name', 'A-Z'],
            ] as const).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setSort(k)}
                className={`px-3 py-1 rounded text-[11px] font-semibold uppercase whitespace-nowrap transition-colors ${
                  sort === k ? 'bg-cyan-400 text-black' : 'text-neutral-400 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="card-premium p-4 text-center mb-4">
            <p className="text-red-400 text-sm">Failed to load · {error}</p>
            <button onClick={() => load(false)} className="mt-2 text-xs text-hub-yellow hover:underline">retry</button>
          </div>
        )}

        {!data && !error && (
          <div className="card-premium p-12 text-center text-neutral-500 text-sm">Loading equity quotes…</div>
        )}

        {filtered.length === 0 && data && (
          <div className="card-premium p-12 text-center text-neutral-500 text-sm">No tickers match.</div>
        )}

        {filtered.length > 0 && (
          <div className="card-premium p-3 overflow-x-auto">
            <div className="grid grid-cols-[80px,1fr,90px,90px,90px,90px,90px,90px] gap-3 px-3 py-1.5 text-[10px] uppercase tracking-wider text-neutral-500 font-semibold border-b border-white/[0.04] mb-1">
              <div>Ticker</div>
              <div>Name</div>
              <div className="text-right">Price</div>
              <div className="text-right">24h</div>
              <div className="text-right">90d</div>
              <div className="text-right">vs BTC 90d</div>
              <div className="text-right">Corr</div>
              <div className="text-right">Beta</div>
            </div>
            {filtered.map(r => {
              const upDay = (r.change24h ?? 0) >= 0;
              const up90d = (r.return90d ?? 0) >= 0;
              const btc90 = data?.btc.return90d ?? 0;
              const vsBtc = r.return90d != null ? r.return90d - btc90 : null;
              const vsBtcUp = (vsBtc ?? 0) >= 0;
              return (
                <div
                  key={r.ticker}
                  className="grid grid-cols-[80px,1fr,90px,90px,90px,90px,90px,90px] gap-3 px-3 py-2 items-center rounded hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <a
                      href={`https://finance.yahoo.com/quote/${r.ticker}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-white font-bold hover:text-hub-yellow transition-colors"
                    >
                      {r.ticker}
                    </a>
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs text-neutral-300 truncate">{r.name}</div>
                    <span className={`text-[9px] font-semibold uppercase tracking-wider px-1.5 py-px rounded border inline-block mt-0.5 ${CATEGORY_COLORS[r.category]}`}>
                      {CATEGORY_LABELS[r.category]}
                    </span>
                  </div>
                  <div className="text-right font-mono text-xs tabular-nums text-neutral-300">{fmtUsd(r.price)}</div>
                  <div className={`text-right font-mono text-xs tabular-nums inline-flex items-center justify-end gap-1 ${upDay ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {upDay ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {fmtPct(r.change24h, 2)}
                  </div>
                  <div className={`text-right font-mono text-xs tabular-nums font-semibold ${up90d ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {fmtPct(r.return90d, 1)}
                  </div>
                  <div className={`text-right font-mono text-xs tabular-nums ${vsBtcUp ? 'text-emerald-300' : 'text-rose-300'}`}>
                    {fmtPct(vsBtc, 1)}
                  </div>
                  <div className={`text-right font-mono text-xs tabular-nums ${corrColor(r.correlationToBtc)}`}>
                    {r.correlationToBtc != null ? r.correlationToBtc.toFixed(2) : '—'}
                  </div>
                  <div className="text-right font-mono text-xs tabular-nums text-neutral-300">
                    {fmtBeta(r.betaToBtc)}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4 p-3 bg-white/[0.02] rounded-lg text-[11px] text-neutral-500 leading-relaxed">
          <strong className="text-neutral-300">How to read:</strong> Beta of 2.0 means
          the stock moves 2× as much as BTC on average. Correlation 1.0 = perfect
          positive fit; 0 = unrelated; -1 = perfect inverse.
          Miners (MARA, RIOT, CLSK) typically have the highest beta. ETFs (IBIT, FBTC)
          should be near 1.0 by construction. Treasury cos (MSTR) often levered to BTC
          via balance-sheet exposure. Source: Yahoo Finance daily closes.
        </div>
      </main>
      <Footer />
    </>
  );
}
