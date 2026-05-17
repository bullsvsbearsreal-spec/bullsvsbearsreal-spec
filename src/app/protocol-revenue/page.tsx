'use client';

import { useState, useMemo, useEffect } from 'react';
import { useApi } from '@/hooks/useSWRApi';
import { useSearchParams } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import DataFreshness from '@/components/DataFreshness';
import RefreshButton from '@/components/RefreshButton';
import UsdDisplay from '@/components/UsdDisplay';
import PageHero from '@/components/PageHero';
import { DollarSign, TrendingUp, TrendingDown, Search } from 'lucide-react';

interface RevenueRow {
  name: string;
  category: string;
  logo: string | null;
  chains: string[];
  fees24h: number;
  fees7d: number;
  fees30d: number;
  change1d: number;
  change7d: number;
  change30d: number;
  annualizedRevenue: number;
}

interface RevenueResponse {
  data: RevenueRow[];
  summary: {
    total24h: number;
    total7d: number;
    total30d: number;
    protocolCount: number;
    topProtocol: string | null;
    topFees24h: number;
  };
  meta: { timeframe: string; category: string; timestamp: number; categories: { name: string; count: number }[] };
}

type Timeframe = '24h' | '7d' | '30d';

function fmtPct(n: number): string {
  if (!Number.isFinite(n) || n === 0) return '—';
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
}

export default function ProtocolRevenuePage() {
  const searchParams = useSearchParams();
  const initTimeframe = (searchParams.get('timeframe') as Timeframe) || '24h';
  const initCategory = searchParams.get('category') || 'all';

  const [timeframe, setTimeframe] = useState<Timeframe>(initTimeframe);
  const [category, setCategory] = useState<string>(initCategory);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const q = new URLSearchParams();
    if (timeframe !== '24h') q.set('timeframe', timeframe);
    if (category !== 'all') q.set('category', category);
    const qs = q.toString();
    globalThis.history?.replaceState(null, '', qs ? `/protocol-revenue?${qs}` : '/protocol-revenue');
  }, [timeframe, category]);

  const { data, isLoading, isRefreshing, error, refresh } = useApi<RevenueResponse>({
    key: `protocol-revenue:${timeframe}:${category}`,
    fetcher: async () => {
      const res = await fetch(`/api/protocol-revenue?timeframe=${timeframe}&category=${encodeURIComponent(category)}&limit=100`, {
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    refreshInterval: 300_000,
  });

  const filtered = useMemo(() => {
    if (!data?.data) return [];
    const q = search.toLowerCase().trim();
    if (!q) return data.data;
    return data.data.filter(r =>
      r.name.toLowerCase().includes(q) ||
      r.category.toLowerCase().includes(q) ||
      r.chains.some(c => c.toLowerCase().includes(q)),
    );
  }, [data, search]);

  const sortKey: keyof RevenueRow =
    timeframe === '24h' ? 'fees24h' : timeframe === '7d' ? 'fees7d' : 'fees30d';
  const changeKey: keyof RevenueRow =
    timeframe === '24h' ? 'change1d' : timeframe === '7d' ? 'change7d' : 'change30d';

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main className="max-w-[1400px] mx-auto w-full px-4 py-6">
        <PageHero
          icon={DollarSign}
          eyebrow="On-chain · revenue leaderboard"
          title="Protocol"
          accentNoun="revenue"
          accent="emerald"
          description={
            <>Which protocols actually make money. Fees collected per timeframe,
              ranked. Source: DeFiLlama. Useful filter against
              <span className="text-white"> &ldquo;has a token but no users&rdquo;</span> traps.</>
          }
          className="mb-4"
          actions={
            <>
              <DataFreshness exchangeCount={data?.summary?.protocolCount ?? 0} lastUpdated={data?.meta?.timestamp ?? null} sources={['DeFiLlama']} />
              <RefreshButton onRefresh={refresh} isRefreshing={isRefreshing} />
            </>
          }
        />

        {data?.summary && (
          <div
            className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4"
            aria-live="polite"
            aria-atomic="false"
          >
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">Top 100 · 24h fees</div>
              <div className="font-mono tabular-nums text-sm font-semibold text-white">
                <UsdDisplay amount={data.summary.total24h} />
              </div>
            </div>
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">7d fees</div>
              <div className="font-mono tabular-nums text-sm font-semibold text-white">
                <UsdDisplay amount={data.summary.total7d} />
              </div>
            </div>
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">30d fees</div>
              <div className="font-mono tabular-nums text-sm font-semibold text-white">
                <UsdDisplay amount={data.summary.total30d} />
              </div>
            </div>
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">Protocols</div>
              <div className="font-mono tabular-nums text-sm font-semibold text-white">{data.summary.protocolCount.toLocaleString()}</div>
            </div>
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">Top earner 24h</div>
              <div className="font-mono tabular-nums text-sm font-semibold text-hub-yellow">{data.summary.topProtocol || '—'}</div>
              <div className="text-[10px] text-neutral-500 font-mono">
                <UsdDisplay amount={data.summary.topFees24h} />
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col md:flex-row md:items-center gap-3 mb-3">
          <div className="flex items-center gap-1 bg-white/[0.03] rounded-lg p-0.5">
            {(['24h', '7d', '30d'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTimeframe(t)}
                className={`px-3 py-1 rounded text-[11px] font-semibold uppercase transition-colors ${
                  timeframe === t ? 'bg-hub-yellow text-black' : 'text-neutral-400 hover:text-white'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="bg-white/[0.04] border border-white/[0.06] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-white/[0.12]"
            aria-label="Filter by category"
          >
            <option value="all">All categories</option>
            {data?.meta?.categories?.map(c => (
              <option key={c.name} value={c.name}>
                {c.name} ({c.count})
              </option>
            ))}
          </select>

          <div className="md:ml-auto relative flex-1 md:flex-initial md:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-neutral-600 pointer-events-none" />
            <input
              type="text"
              placeholder="Filter protocol or chain"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-neutral-600 focus:outline-none focus:border-white/[0.12]"
            />
          </div>
        </div>

        <div className="card-premium p-3 min-h-[500px]">
          <div className="hidden md:grid md:grid-cols-[40px,1fr,130px,110px,110px,110px,120px] gap-3 px-3 py-1.5 text-[10px] uppercase tracking-wider text-neutral-500 font-semibold border-b border-white/[0.04] mb-1">
            <div>#</div>
            <div>Protocol</div>
            <div className="text-right">Category</div>
            <div className="text-right">24h fees</div>
            <div className="text-right">7d fees</div>
            <div className="text-right">30d fees</div>
            <div className="text-right">Change</div>
          </div>

          {isLoading && (
            <div className="space-y-1.5 p-1">
              {Array.from({ length: 10 }, (_, i) => <div key={i} className="h-12 bg-white/[0.03] rounded animate-pulse" />)}
            </div>
          )}

          {error && (
            <div className="text-center py-12 text-red-400 text-sm">Failed to load · {String(error)}</div>
          )}

          {!isLoading && !error && filtered.length === 0 && (
            <div className="text-center py-12 text-neutral-500 text-sm">No protocols match your filters.</div>
          )}

          {filtered.map((r, i) => {
            const value = r[sortKey] as number;
            const change = r[changeKey] as number;
            return (
              <div
                key={r.name}
                className="md:grid md:grid-cols-[40px,1fr,130px,110px,110px,110px,120px] gap-3 px-3 py-2 items-center rounded hover:bg-white/[0.02] transition-colors"
              >
                <div className="text-right text-neutral-500 font-mono text-xs tabular-nums">{i + 1}</div>
                <div className="flex items-center gap-2 min-w-0">
                  {r.logo && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.logo} alt="" className="w-4 h-4 rounded-full flex-shrink-0" loading="lazy" />
                  )}
                  <div className="min-w-0">
                    <div className="text-sm text-white font-semibold truncate">{r.name}</div>
                    <div className="text-[10px] text-neutral-600 truncate">
                      {r.chains.slice(0, 3).join(' · ')}
                      {r.chains.length > 3 && ` +${r.chains.length - 3}`}
                    </div>
                  </div>
                </div>
                <div className="text-right text-[10px] text-neutral-500 uppercase tracking-wider">{r.category}</div>
                <div className="text-right font-mono text-xs tabular-nums text-white">
                  <UsdDisplay amount={r.fees24h} />
                </div>
                <div className="text-right font-mono text-xs tabular-nums text-neutral-300">
                  <UsdDisplay amount={r.fees7d} />
                </div>
                <div className="text-right font-mono text-xs tabular-nums text-neutral-400">
                  <UsdDisplay amount={r.fees30d} />
                </div>
                <div className={`text-right font-mono text-xs tabular-nums font-semibold inline-flex items-center justify-end gap-1 ${
                  change > 0 ? 'text-green-400' : change < 0 ? 'text-red-400' : 'text-neutral-500'
                }`}>
                  {change > 0 ? <TrendingUp className="w-3 h-3" /> : change < 0 ? <TrendingDown className="w-3 h-3" /> : null}
                  {fmtPct(change)}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 text-[10px] text-neutral-600 flex items-center gap-2">
          <DollarSign className="w-3 h-3" />
          Fees data from DeFiLlama · updates hourly. Fees ≠ revenue for all protocols (some burn/distribute, some keep to treasury).
        </div>
      </main>
      <Footer />
    </div>
  );
}
