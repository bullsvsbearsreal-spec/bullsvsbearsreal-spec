'use client';

/**
 * /listing-radar — pre-listing leak tracker.
 *
 * Live feed of CEX listing announcements (Binance for now). Each row shows
 * tickers, type (spot/perp/futures/delisting), publish time, and a "hot"
 * flag for sub-6h announcements where the front-run window is still open.
 */
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Radar, RefreshCw, ExternalLink, Filter, Flame, AlertTriangle } from 'lucide-react';

interface ListingEvent {
  id: string;
  venue: 'Binance' | 'Coinbase';
  type: 'spot' | 'futures' | 'perp' | 'option' | 'delisting' | 'other';
  tickers: string[];
  title: string;
  publishedAt: number;
  ageHours: number;
  url: string;
  hot: boolean;
}

interface ApiResponse {
  ts: number;
  events: ListingEvent[];
  summary: {
    total: number;
    last24h: number;
    last6h: number;
    byVenue: Record<string, number>;
    byType: Record<string, number>;
  };
}

const TYPE_TONE: Record<ListingEvent['type'], string> = {
  spot:     'border-emerald-400/40 bg-emerald-500/10 text-emerald-300',
  perp:     'border-purple-400/40 bg-purple-500/10 text-purple-300',
  futures:  'border-blue-400/40 bg-blue-500/10 text-blue-300',
  option:   'border-cyan-400/40 bg-cyan-500/10 text-cyan-300',
  delisting:'border-red-400/40 bg-red-500/10 text-red-300',
  other:    'border-neutral-500/30 bg-white/[0.04] text-neutral-300',
};

const TYPE_LABEL: Record<ListingEvent['type'], string> = {
  spot: 'Spot', perp: 'Perp', futures: 'Futures', option: 'Option', delisting: 'Delisting', other: 'Other',
};

function fmtAge(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}m ago`;
  if (hours < 24) return `${hours.toFixed(1)}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

const TYPES: Array<ListingEvent['type'] | 'all'> = ['all', 'spot', 'perp', 'futures', 'delisting'];

export default function ListingRadarPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | ListingEvent['type']>('all');
  const [hotOnly, setHotOnly] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/listing-radar', { signal: AbortSignal.timeout(20_000) });
      if (!res.ok) {
        setError(`HTTP ${res.status}`);
        return;
      }
      setData(await res.json());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    let evs = data.events;
    if (filter !== 'all') evs = evs.filter(e => e.type === filter);
    if (hotOnly) evs = evs.filter(e => e.hot);
    return evs;
  }, [data, filter, hotOnly]);

  return (
    <>
      <Header />
      <main className="max-w-[1400px] mx-auto px-4 py-6">
        <div className="mb-4 flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <Radar className="w-5 h-5 text-cyan-400" />
              <h1 className="text-2xl font-bold text-white">Listing Radar</h1>
              <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-cyan-400/15 text-cyan-400 font-bold">
                live
              </span>
            </div>
            <p className="text-sm text-neutral-500 mt-1 max-w-3xl">
              CEX listing announcements in real time. Listings historically pump 30–200% in the first
              24 hours — the &lsquo;hot&rsquo; flag marks announcements still inside the front-run window.
              Source: Binance announcement API. Coinbase + OKX coming.
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-hub-yellow disabled:opacity-40"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> refresh
          </button>
        </div>

        {/* Summary cards */}
        {data && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
            <SummaryCell label="Total tracked" value={data.summary.total.toString()} />
            <SummaryCell label="Last 24h" value={data.summary.last24h.toString()} valueColor="text-cyan-400" />
            <SummaryCell label="Hot (<6h)" value={data.summary.last6h.toString()} valueColor="text-orange-400" />
            <SummaryCell
              label="Spot vs Perp"
              value={`${data.summary.byType.spot ?? 0} / ${data.summary.byType.perp ?? 0}`}
            />
          </div>
        )}

        {/* Filter row */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <Filter className="w-3.5 h-3.5 text-neutral-500" />
          {TYPES.map(t => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`text-[11px] px-2 py-1 rounded font-medium ${
                filter === t ? 'bg-hub-yellow text-black' : 'bg-white/[0.04] text-neutral-400 hover:text-white'
              }`}
            >
              {t === 'all' ? 'All' : TYPE_LABEL[t]} ({t === 'all' ? data?.summary.total ?? 0 : data?.summary.byType[t] ?? 0})
            </button>
          ))}
          <button
            onClick={() => setHotOnly(!hotOnly)}
            className={`text-[11px] px-2 py-1 rounded font-medium inline-flex items-center gap-1 ${
              hotOnly ? 'bg-orange-400 text-black' : 'bg-white/[0.04] text-neutral-400 hover:text-white'
            }`}
          >
            <Flame className="w-3 h-3" />
            Hot only
          </button>
        </div>

        {error && (
          <div className="card-premium p-4 border border-red-400/30 bg-red-500/5 text-sm text-red-300 mb-4 inline-flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {!data && !error && (
          <div className="card-premium p-8 text-center text-neutral-500 text-sm">Scanning announcements…</div>
        )}

        {data && filtered.length === 0 && (
          <div className="card-premium p-8 text-center text-neutral-500 text-sm">
            No listings match this filter.
          </div>
        )}

        {/* Event list */}
        <div className="space-y-1.5">
          {filtered.map(e => (
            <a
              key={e.id}
              href={e.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`card-premium px-3 py-2 flex items-center gap-3 hover:bg-white/[0.03] transition-colors ${
                e.hot ? 'border border-orange-400/30 bg-orange-500/[0.04]' : ''
              }`}
            >
              {/* Type pill */}
              <span className={`text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border flex-shrink-0 ${TYPE_TONE[e.type]}`}>
                {TYPE_LABEL[e.type]}
              </span>

              {/* Tickers */}
              {e.tickers.length > 0 && (
                <span className="flex items-center gap-1 flex-shrink-0">
                  {e.tickers.slice(0, 3).map(t => (
                    <span key={t} className="text-sm font-bold text-white tabular-nums">{t}</span>
                  ))}
                  {e.tickers.length > 3 && <span className="text-[10px] text-neutral-500">+{e.tickers.length - 3}</span>}
                </span>
              )}

              {/* Title */}
              <span className="text-[12px] text-neutral-400 flex-1 truncate">{e.title}</span>

              {/* Hot flag */}
              {e.hot && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-orange-300 px-1 py-0.5 rounded bg-orange-500/15 border border-orange-400/30 flex-shrink-0">
                  <Flame className="w-2.5 h-2.5" /> HOT
                </span>
              )}

              {/* Age + venue */}
              <div className="text-right flex-shrink-0">
                <div className="text-[10px] text-neutral-500 whitespace-nowrap">{fmtAge(e.ageHours)}</div>
                <div className="text-[9px] text-neutral-600">{e.venue}</div>
              </div>

              <ExternalLink className="w-3 h-3 text-neutral-600 flex-shrink-0" />
            </a>
          ))}
        </div>

        {data && (
          <div className="text-center mt-4 text-[10px] text-neutral-600">
            Last refresh: {new Date(data.ts).toLocaleTimeString()} · cached 5 min · {filtered.length} of {data.events.length} shown
          </div>
        )}
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
