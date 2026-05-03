'use client';

import { useApi } from '@/hooks/useSWRApi';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import DataFreshness from '@/components/DataFreshness';
import RefreshButton from '@/components/RefreshButton';
import UsdDisplay from '@/components/UsdDisplay';
import { Globe, TrendingUp, TrendingDown, Info } from 'lucide-react';

interface Venue {
  exchange: string;
  currency: string;
  nativePrice: number;
  usdPrice: number;
  volume24h?: number;
}

interface PremiumRow {
  symbol: 'BTC' | 'ETH';
  globalUsd: number;
  usGap: { venue: Venue | null; gapPct: number | null };
  kimchi: { venue: Venue | null; gapPct: number | null };
  japanGap: { venue: Venue | null; gapPct: number | null };
}

interface PremiumsResponse {
  rows: PremiumRow[];
  meta: {
    timestamp: number;
    fxRates: { usdKrw: number; usdJpy: number };
    sources: string[];
  };
}

function fmtPct(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return `${n >= 0 ? '+' : ''}${n.toFixed(3)}%`;
}

function pctColor(n: number | null): string {
  if (n == null || !Number.isFinite(n) || Math.abs(n) < 0.05) return 'text-neutral-300';
  return n >= 0 ? 'text-green-400' : 'text-red-400';
}

function pctBgCell(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return '';
  const abs = Math.abs(n);
  if (abs >= 1.0) return n > 0 ? 'bg-green-500/[0.08]' : 'bg-red-500/[0.08]';
  if (abs >= 0.3) return n > 0 ? 'bg-green-500/[0.04]' : 'bg-red-500/[0.04]';
  return '';
}

export default function PremiumsPage() {
  const { data, isLoading, isRefreshing, error, refresh } = useApi<PremiumsResponse>({
    key: 'premiums',
    fetcher: async () => {
      const res = await fetch('/api/premiums', { signal: AbortSignal.timeout(12_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    refreshInterval: 30_000,
  });

  const btcRow = data?.rows?.find(r => r.symbol === 'BTC');
  const maxGapAbs = data?.rows
    ? Math.max(
        ...data.rows.flatMap(r =>
          [r.usGap.gapPct, r.kimchi.gapPct, r.japanGap.gapPct]
            .filter((v): v is number => Number.isFinite(v as number))
            .map(v => Math.abs(v)),
        ),
        0,
      )
    : 0;

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main className="max-w-[1400px] mx-auto w-full px-4 py-6">
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <div className="w-7 h-7 rounded-md bg-blue-500/10 flex items-center justify-center">
              <Globe className="w-4 h-4 text-blue-400" />
            </div>
            <h1 className="text-xl font-bold text-white">Regional Premiums</h1>
            <div className="ml-auto flex items-center gap-1">
              <DataFreshness exchangeCount={3} lastUpdated={data?.meta?.timestamp ?? null} sources={['Binance', 'Coinbase', 'Upbit', 'bitFlyer']} />
              <RefreshButton onRefresh={refresh} isRefreshing={isRefreshing} />
            </div>
          </div>
          <p className="text-sm text-neutral-500">
            BTC / ETH price gaps between regional venues and the global (Binance USDT) reference. Coinbase = US, Upbit = Korea, bitFlyer = Japan.
          </p>
        </div>

        {data?.rows && (
          <div
            className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4"
            aria-live="polite"
            aria-atomic="false"
          >
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">BTC Global (Binance)</div>
              <div className="font-mono tabular-nums text-sm font-semibold text-white">
                <UsdDisplay amount={btcRow?.globalUsd ?? 0} />
              </div>
            </div>
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">BTC Coinbase gap</div>
              <div className={`font-mono tabular-nums text-sm font-semibold ${pctColor(btcRow?.usGap.gapPct ?? null)}`}>
                {fmtPct(btcRow?.usGap.gapPct ?? null)}
              </div>
              <div className="text-[10px] text-neutral-600 mt-0.5 font-mono">US demand</div>
            </div>
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">BTC Kimchi gap</div>
              <div className={`font-mono tabular-nums text-sm font-semibold ${pctColor(btcRow?.kimchi.gapPct ?? null)}`}>
                {fmtPct(btcRow?.kimchi.gapPct ?? null)}
              </div>
              <div className="text-[10px] text-neutral-600 mt-0.5 font-mono">Korean demand</div>
            </div>
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">Biggest gap</div>
              <div className="font-mono tabular-nums text-sm font-semibold text-hub-yellow">
                {maxGapAbs.toFixed(2)}%
              </div>
              <div className="text-[10px] text-neutral-600 mt-0.5 font-mono">any venue · any asset</div>
            </div>
          </div>
        )}

        {/* Alert banner when any premium exceeds ±1% */}
        {data?.rows && maxGapAbs >= 1.0 && (
          <div className="card-premium p-3 mb-4 flex items-start gap-2 border border-yellow-400/30 bg-yellow-500/[0.04]">
            <TrendingUp className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div className="text-[12px] text-yellow-200">
              <span className="font-semibold">Regional divergence &gt; 1%</span>
              <span className="text-yellow-200/70"> — one market is trading meaningfully off global. Historically precedes short-term mean-reversion or confirms a regional flow.</span>
            </div>
          </div>
        )}

        <div className="card-premium p-3 min-h-[200px]">
          <div className="hidden md:grid md:grid-cols-[80px,1fr,1fr,1fr,1fr] gap-3 px-3 py-1.5 text-[10px] uppercase tracking-wider text-neutral-500 font-semibold border-b border-white/[0.04] mb-1">
            <div>Asset</div>
            <div className="text-right">Global · Binance</div>
            <div className="text-right">🇺🇸 Coinbase</div>
            <div className="text-right">🇰🇷 Upbit</div>
            <div className="text-right">🇯🇵 bitFlyer</div>
          </div>

          {isLoading && (
            <div className="space-y-1.5 p-1">
              {Array.from({ length: 2 }, (_, i) => <div key={i} className="h-16 bg-white/[0.03] rounded animate-pulse" />)}
            </div>
          )}

          {error && (
            <div className="text-center py-12 text-red-400 text-sm">Failed to load · {String(error)}</div>
          )}

          {data?.rows?.map(r => (
            <div
              key={r.symbol}
              className="md:grid md:grid-cols-[80px,1fr,1fr,1fr,1fr] gap-3 px-3 py-3 items-center rounded hover:bg-white/[0.02] transition-colors"
            >
              <div className="text-sm text-white font-bold">{r.symbol}</div>
              <div className="text-right font-mono text-sm tabular-nums text-white font-semibold">
                <UsdDisplay amount={r.globalUsd} />
              </div>
              {[r.usGap, r.kimchi, r.japanGap].map((gap, idx) => (
                <div key={idx} className={`text-right rounded px-2 py-1 ${pctBgCell(gap.gapPct)}`}>
                  <div className={`font-mono tabular-nums text-sm font-semibold inline-flex items-center justify-end gap-1 ${pctColor(gap.gapPct)}`}>
                    {gap.gapPct != null && gap.gapPct > 0.05 ? <TrendingUp className="w-3 h-3" /> : gap.gapPct != null && gap.gapPct < -0.05 ? <TrendingDown className="w-3 h-3" /> : null}
                    {fmtPct(gap.gapPct)}
                  </div>
                  {gap.venue && (
                    <div className="text-[10px] text-neutral-600 font-mono tabular-nums mt-0.5">
                      {gap.venue.currency} <UsdDisplay amount={gap.venue.usdPrice} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>

        {data?.meta?.fxRates && (
          <div className="mt-3 text-[10px] text-neutral-600 flex flex-wrap items-center gap-3">
            <span>FX: 1 USD = <span className="text-neutral-400 font-mono">{data.meta.fxRates.usdKrw.toFixed(1)}</span> KRW</span>
            <span>· 1 USD = <span className="text-neutral-400 font-mono">{data.meta.fxRates.usdJpy.toFixed(1)}</span> JPY</span>
          </div>
        )}

        <div className="mt-4 p-3 bg-white/[0.02] rounded-lg text-[11px] text-neutral-500 leading-relaxed flex items-start gap-2">
          <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <div>
            <strong className="text-neutral-300">How to read it:</strong> A positive Coinbase gap means US buyers are paying above global price — a classic institutional accumulation signal.
            A large positive Kimchi gap historically correlates with retail-driven Korean crypto manias.
            Gaps within ±0.1% are just FX / latency noise. Anything above ±0.5% is worth watching; ±1.5%+ is a genuine regional imbalance.
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
