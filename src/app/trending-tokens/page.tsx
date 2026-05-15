'use client';

import { useState, useMemo } from 'react';
import { useApi } from '@/hooks/useSWRApi';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import DataFreshness from '@/components/DataFreshness';
import RefreshButton from '@/components/RefreshButton';
import UsdDisplay from '@/components/UsdDisplay';
import { Rocket, Info, TrendingUp, TrendingDown, ExternalLink } from 'lucide-react';

interface TrendingRow {
  address: string;
  chain: string;
  name: string;
  symbol: string;
  imageUrl: string | null;
  priceUsd: number;
  volume24h: number;
  txns24h: number;
  buys24h: number;
  sells24h: number;
  priceChange24h: number;
  priceChange1h: number;
  liquidityUsd: number;
  marketCap: number;
  ageHours: number;
  boostAmount: number;
  dexScreenerUrl: string;
  twitter: string | null;
  telegram: string | null;
}

interface TrendingResponse {
  data: TrendingRow[];
  summary: {
    tokenCount: number;
    totalVolume24h: number;
    totalLiquidity: number;
    freshTokensPct: number;
    chainBreakdown: Array<{ chain: string; count: number }>;
  };
  meta: { timestamp: number; chain: string; sort: string; returned: number };
}

type Sort = 'boost' | 'volume' | 'change' | 'age';
type Chain = 'all' | 'solana' | 'ethereum' | 'base' | 'bsc';

function fmtAge(hours: number): string {
  if (hours < 1) return `${Math.max(1, Math.floor(hours * 60))}m`;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function fmtPct(n: number): string {
  if (!Number.isFinite(n) || n === 0) return '—';
  if (Math.abs(n) >= 10_000) return `${n >= 0 ? '+' : ''}${(n / 1000).toFixed(1)}Kx`;
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
}

function fmtPrice(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '—';
  if (n < 0.00001) return `$${n.toExponential(2)}`;
  if (n < 0.01) return `$${n.toFixed(6)}`;
  if (n < 1) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

function chainColor(c: string): string {
  const map: Record<string, string> = {
    solana:   '#9945ff',
    ethereum: '#627eea',
    base:     '#0052ff',
    bsc:      '#f3ba2f',
    arbitrum: '#28a0f0',
    polygon:  '#8247e5',
    avalanche:'#e84142',
  };
  return map[c.toLowerCase()] || '#888';
}

function buySellRatio(buys: number, sells: number): number {
  const total = buys + sells;
  return total > 0 ? (buys / total) * 100 : 50;
}

export default function TrendingTokensPage() {
  const [chain, setChain] = useState<Chain>('all');
  const [sort, setSort] = useState<Sort>('boost');

  const { data, isLoading, isRefreshing, error, refresh } = useApi<TrendingResponse>({
    key: `trending-tokens:${chain}:${sort}`,
    fetcher: async () => {
      const res = await fetch(`/api/trending-tokens?chain=${chain}&sort=${sort}&limit=30`, {
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    refreshInterval: 60_000,
  });

  const rows = useMemo(() => data?.data ?? [], [data]);
  const chains = data?.summary?.chainBreakdown ?? [];

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main className="max-w-[1400px] mx-auto w-full px-4 py-6">
        <header className="mb-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 mb-2">
                <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-pink-500/20 to-pink-500/[0.04] border border-pink-400/25 flex items-center justify-center">
                  <Rocket className="w-4 h-4 text-pink-300" />
                </div>
                <span className="text-[10px] uppercase tracking-[0.18em] text-neutral-500 font-bold">Memecoin radar</span>
              </div>
              <h1 className="text-3xl sm:text-[34px] font-extrabold tracking-tight text-white leading-[1.05]">
                Trending <span className="text-pink-300">tokens</span>
              </h1>
              <p className="text-[13px] text-neutral-400 mt-2 max-w-xl leading-relaxed">
                Boosted &amp; promoted tokens on DexScreener enriched with live market data —
                price, volume, txn count, buy/sell ratio, age. Raw memecoin screener for hunters.
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0 self-start lg:self-end">
              <DataFreshness exchangeCount={data?.summary?.tokenCount ?? 0} lastUpdated={data?.meta?.timestamp ?? null} sources={['DexScreener']} />
              <RefreshButton onRefresh={refresh} isRefreshing={isRefreshing} />
            </div>
          </div>
        </header>

        {data?.summary && (
          <div
            className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4"
            aria-live="polite"
            aria-atomic="false"
          >
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">Tracked</div>
              <div className="font-mono tabular-nums text-sm font-semibold text-white">
                {data.summary.tokenCount}
              </div>
              <div className="text-[10px] text-neutral-600 mt-0.5 font-mono">{data.summary.freshTokensPct.toFixed(0)}% under 24h old</div>
            </div>
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">Combined vol 24h</div>
              <div className="font-mono tabular-nums text-sm font-semibold text-pink-400">
                <UsdDisplay amount={data.summary.totalVolume24h} />
              </div>
            </div>
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">Combined liquidity</div>
              <div className="font-mono tabular-nums text-sm font-semibold text-white">
                <UsdDisplay amount={data.summary.totalLiquidity} />
              </div>
            </div>
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">Top chain</div>
              <div className="font-mono tabular-nums text-sm font-semibold text-white">
                {chains[0]?.chain || '—'}
              </div>
              <div className="text-[10px] text-neutral-600 mt-0.5 font-mono">
                {chains[0] ? `${chains[0].count} tokens` : ''}
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col md:flex-row md:items-center gap-3 mb-3">
          <div className="flex items-center gap-1 bg-white/[0.03] rounded-lg p-0.5 w-fit">
            {([
              ['all', 'All'],
              ['solana', 'Solana'],
              ['ethereum', 'ETH'],
              ['base', 'Base'],
              ['bsc', 'BNB'],
            ] as const).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setChain(k)}
                className={`px-3 py-1 rounded text-[11px] font-semibold uppercase transition-colors ${
                  chain === k ? 'bg-pink-400 text-black' : 'text-neutral-400 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 bg-white/[0.03] rounded-lg p-0.5 w-fit">
            {([
              ['boost', 'By boost'],
              ['volume', 'By volume'],
              ['change', 'By 24h move'],
              ['age', 'Newest'],
            ] as const).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setSort(k)}
                className={`px-3 py-1 rounded text-[11px] font-semibold uppercase transition-colors ${
                  sort === k ? 'bg-hub-yellow text-black' : 'text-neutral-400 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="card-premium p-3 min-h-[500px]">
          <div className="hidden md:grid md:grid-cols-[40px,1fr,100px,110px,100px,100px,110px,70px,40px] gap-3 px-3 py-1.5 text-[10px] uppercase tracking-wider text-neutral-500 font-semibold border-b border-white/[0.04] mb-1">
            <div>#</div>
            <div>Token</div>
            <div className="text-right">Price</div>
            <div className="text-right">24h Δ</div>
            <div className="text-right">Volume</div>
            <div className="text-right">MCap</div>
            <div className="text-right">Buys/Sells</div>
            <div className="text-right">Age</div>
            <div className="text-right"></div>
          </div>

          {isLoading && (
            <div className="space-y-1.5 p-1">
              {Array.from({ length: 10 }, (_, i) => <div key={i} className="h-12 bg-white/[0.03] rounded animate-pulse" />)}
            </div>
          )}

          {error && (
            <div className="text-center py-12 text-red-400 text-sm">Failed to load · {String(error)}</div>
          )}

          {!isLoading && !error && rows.length === 0 && (
            <div className="text-center py-12 text-neutral-500 text-sm">No trending tokens for this filter.</div>
          )}

          {rows.map((r, i) => {
            const bsPct = buySellRatio(r.buys24h, r.sells24h);
            return (
              <div
                key={r.address}
                className="md:grid md:grid-cols-[40px,1fr,100px,110px,100px,100px,110px,70px,40px] gap-3 px-3 py-2 items-center rounded hover:bg-white/[0.02] transition-colors"
              >
                <div className="text-right text-neutral-500 font-mono text-xs tabular-nums">{i + 1}</div>
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: chainColor(r.chain) }} aria-hidden />
                  {r.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.imageUrl} alt="" className="w-5 h-5 rounded-full flex-shrink-0 bg-white/5" loading="lazy" />
                  ) : null}
                  <div className="min-w-0">
                    <div className="text-sm text-white font-semibold truncate">{r.symbol}</div>
                    <div className="text-[10px] text-neutral-600 font-mono truncate">{r.chain} · {r.name}</div>
                  </div>
                </div>
                <div className="text-right font-mono text-xs tabular-nums text-white">
                  {fmtPrice(r.priceUsd)}
                </div>
                <div className={`text-right font-mono text-xs tabular-nums font-semibold inline-flex items-center justify-end gap-1 ${r.priceChange24h > 0 ? 'text-green-400' : r.priceChange24h < 0 ? 'text-red-400' : 'text-neutral-500'}`}>
                  {r.priceChange24h > 0 ? <TrendingUp className="w-3 h-3" /> : r.priceChange24h < 0 ? <TrendingDown className="w-3 h-3" /> : null}
                  {fmtPct(r.priceChange24h)}
                </div>
                <div className="text-right font-mono text-xs tabular-nums text-neutral-200">
                  <UsdDisplay amount={r.volume24h} />
                </div>
                <div className="text-right font-mono text-xs tabular-nums text-neutral-400">
                  <UsdDisplay amount={r.marketCap} />
                </div>
                <div>
                  <div className="flex items-center gap-1 text-[10px] font-mono tabular-nums">
                    <span className="text-green-400">{r.buys24h}</span>
                    <span className="text-neutral-600">/</span>
                    <span className="text-red-400">{r.sells24h}</span>
                  </div>
                  <div className="h-1 bg-red-400/30 rounded-full overflow-hidden mt-1">
                    <div
                      className="h-full bg-green-400/60 rounded-full"
                      style={{ width: `${bsPct}%` }}
                      aria-hidden
                    />
                  </div>
                </div>
                <div className="text-right font-mono text-xs tabular-nums text-neutral-400">
                  {fmtAge(r.ageHours)}
                </div>
                <div className="text-right">
                  <a
                    href={r.dexScreenerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-end text-neutral-500 hover:text-hub-yellow transition-colors"
                    aria-label={`Open ${r.symbol} on DexScreener`}
                    title="DexScreener"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 p-3 bg-white/[0.02] rounded-lg text-[11px] text-neutral-500 leading-relaxed flex items-start gap-2">
          <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <div>
            Tokens on this list are <em>boosted</em> (paid promotion) on DexScreener, which is a signal of dev/holder attention, not quality or safety.
            Buy/sell ratio and liquidity are better filters than boost amount. Anything under 24h old with under $10k liquidity is almost certainly a rugpull setup.
            Click any token to open DexScreener.
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
