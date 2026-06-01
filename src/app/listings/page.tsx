'use client';

import { useState, useMemo } from 'react';
import { useApi } from '@/hooks/useSWRApi';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import DataFreshness from '@/components/DataFreshness';
import RefreshButton from '@/components/RefreshButton';
import PageHero from '@/components/PageHero';
import { Bell, Info, ExternalLink } from 'lucide-react';

interface ListingRow {
  id: string;
  title: string;
  url: string;
  exchange: string;
  tickers: string[];
  kind: 'spot' | 'perpetual' | 'futures' | 'earn' | 'delist' | 'other';
  publishedAt: number;
  ageMins: number;
}

interface ListingsResponse {
  data: ListingRow[];
  summary: {
    total: number;
    last24h: number;
    last7d: number;
    newestAgeMins: number | null;
    exchanges: Array<{ exchange: string; count: number }>;
  };
  meta: { timestamp: number; returned: number };
}

type Kind = 'all' | 'spot' | 'perpetual' | 'futures' | 'earn' | 'delist';

function fmtAge(mins: number): string {
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

function kindBadge(k: ListingRow['kind']): { label: string; cls: string } {
  switch (k) {
    case 'spot':      return { label: 'spot',       cls: 'bg-white/10 text-neutral-300' };
    case 'perpetual': return { label: 'perpetual',  cls: 'bg-hub-yellow/15 text-hub-yellow' };
    case 'futures':   return { label: 'futures',    cls: 'bg-hub-yellow/10 text-hub-yellow/80' };
    case 'earn':      return { label: 'earn',       cls: 'bg-white/[0.06] text-neutral-400' };
    case 'delist':    return { label: 'delist',     cls: 'bg-red-400/15 text-red-400' };
    default:          return { label: 'other',      cls: 'bg-neutral-500/15 text-neutral-400' };
  }
}

function exchangeColor(ex: string): string {
  const map: Record<string, string> = {
    'Binance':         '#f0b90b',
    'Binance Futures': '#f0b90b',
    'Bybit':           '#f7a600',
    'OKX':             '#ffffff',
    'Coinbase':        '#0052ff',
    'Upbit':           '#093687',
    'Kraken':          '#5741d9',
    'MEXC':            '#0c77e4',
    'KuCoin':          '#24ae8f',
    'HTX':             '#1d3fcf',
    'Gate.io':         '#2354e6',
    'Bitget':          '#00ff00',
    'BingX':           '#2354e6',
    'Phemex':          '#ff4d19',
    'Crypto.com':      '#103f68',
  };
  return map[ex] || '#888';
}

export default function ListingsPage() {
  const [kind, setKind] = useState<Kind>('all');

  const { data, isLoading, isRefreshing, error, refresh } = useApi<ListingsResponse>({
    key: `listings:${kind}`,
    fetcher: async () => {
      const res = await fetch(`/api/listings?kind=${kind}&limit=120`, {
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    refreshInterval: 60_000,
  });

  const rows = useMemo(() => data?.data ?? [], [data]);
  const exchanges = data?.summary?.exchanges ?? [];

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main className="max-w-[1400px] mx-auto w-full px-4 py-6">
        <PageHero
          icon={Bell}
          eyebrow="CEX · announcements"
          title="Exchange"
          accentNoun="listings"
          accent="hub-yellow"
          description={
            <>New listings + delistings from major CEXes, aggregated from
              official announcements. Updated every minute — useful for catching
              the first 60 seconds of a Binance perp launch.</>
          }
          className="mb-4"
          actions={
            <>
              <DataFreshness exchangeCount={exchanges.length} lastUpdated={data?.meta?.timestamp ?? null} sources={['Aggregated']} />
              <RefreshButton onRefresh={refresh} isRefreshing={isRefreshing} />
            </>
          }
        />

        {data?.summary && (
          <div
            className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4"
            aria-live="polite"
            aria-atomic="false"
          >
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">Total events</div>
              <div className="font-mono tabular-nums text-sm font-semibold text-white">
                {data.summary.total.toLocaleString()}
              </div>
              <div className="text-[10px] text-neutral-600 mt-0.5 font-mono">all time in feed</div>
            </div>
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">Last 7 days</div>
              <div className="font-mono tabular-nums text-sm font-semibold text-yellow-400">
                {data.summary.last7d.toLocaleString()}
              </div>
              <div className="text-[10px] text-neutral-600 mt-0.5 font-mono">
                {data.summary.last24h} in last 24h
              </div>
            </div>
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">Most active</div>
              <div className="font-mono tabular-nums text-sm font-semibold text-white truncate">
                {exchanges[0]?.exchange || '—'}
              </div>
              <div className="text-[10px] text-neutral-600 mt-0.5 font-mono">
                {exchanges[0] ? `${exchanges[0].count} listings in 7d` : ''}
              </div>
            </div>
            <div className="card-premium p-3">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 font-medium">Exchanges</div>
              <div className="font-mono tabular-nums text-sm font-semibold text-white">
                {exchanges.length}
              </div>
              <div className="text-[10px] text-neutral-600 mt-0.5 font-mono">tracked</div>
            </div>
          </div>
        )}

        <div className="flex items-center gap-1 bg-white/[0.03] rounded-lg p-0.5 w-fit mb-3 flex-wrap">
          {([
            ['all', 'All'],
            ['spot', 'Spot'],
            ['perpetual', 'Perps'],
            ['futures', 'Futures'],
            ['earn', 'Earn'],
            ['delist', 'Delist'],
          ] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={`px-3 py-1 rounded text-[11px] font-semibold uppercase transition-colors ${
                kind === k ? 'bg-hub-yellow text-black' : 'text-neutral-400 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="card-premium p-3 min-h-[500px]">
          <div className="hidden md:grid md:grid-cols-[90px,130px,1fr,120px,60px,40px] gap-3 px-3 py-1.5 text-[10px] uppercase tracking-wider text-neutral-500 font-semibold border-b border-white/[0.04] mb-1">
            <div>When</div>
            <div>Exchange</div>
            <div>Title</div>
            <div>Tickers</div>
            <div>Type</div>
            <div></div>
          </div>

          {isLoading && (
            <div className="space-y-1.5 p-1">
              {Array.from({ length: 12 }, (_, i) => <div key={i} className="h-10 bg-white/[0.03] rounded animate-pulse" />)}
            </div>
          )}

          {error && (
            <div className="text-center py-12 text-red-400 text-sm">Failed to load · {String(error)}</div>
          )}

          {!isLoading && !error && rows.length === 0 && (
            <div className="text-center py-12 text-neutral-500 text-sm">No listings match this filter.</div>
          )}

          {rows.map(r => {
            const badge = kindBadge(r.kind);
            return (
              <a
                key={r.id}
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="md:grid md:grid-cols-[90px,130px,1fr,120px,60px,40px] gap-3 px-3 py-2 items-center rounded hover:bg-white/[0.02] transition-colors cursor-pointer group"
              >
                <div className="text-xs font-mono tabular-nums text-neutral-500">
                  {fmtAge(r.ageMins)} ago
                </div>
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: exchangeColor(r.exchange) }} />
                  <span className="text-sm text-white font-semibold truncate">{r.exchange}</span>
                </div>
                <div className="text-sm text-neutral-200 truncate group-hover:text-white">
                  {r.title}
                </div>
                <div className="flex flex-wrap gap-1">
                  {r.tickers.slice(0, 3).map(t => (
                    <span key={t} className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-hub-yellow/15 text-hub-yellow">
                      {t}
                    </span>
                  ))}
                  {r.tickers.length > 3 && (
                    <span className="text-[10px] font-mono text-neutral-600 px-1.5 py-0.5">+{r.tickers.length - 3}</span>
                  )}
                </div>
                <div>
                  <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${badge.cls}`}>
                    {badge.label}
                  </span>
                </div>
                <div className="text-right text-neutral-600 group-hover:text-hub-yellow transition-colors">
                  <ExternalLink className="w-3 h-3" />
                </div>
              </a>
            );
          })}
        </div>

        <div className="mt-4 p-3 bg-white/[0.02] rounded-lg text-[11px] text-neutral-500 leading-relaxed flex items-start gap-2">
          <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <div>
            Aggregated from official exchange announcement feeds (Binance, Bybit, OKX, Coinbase, Upbit, Kraken, MEXC, KuCoin, HTX, Gate.io, Bitget, BingX, Phemex). Tickers are extracted heuristically from titles, click any row to open the original announcement.
            Delisting events are flagged red. New spot/perpetual listings often move markets on the first 24 hours, fade after.
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
