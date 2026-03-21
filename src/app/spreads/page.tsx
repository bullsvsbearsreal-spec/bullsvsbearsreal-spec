'use client';

import React, { useState, useMemo } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Pagination from '@/app/funding/components/Pagination';
import { TokenIconSimple } from '@/components/TokenIcon';
import { ExchangeLogo } from '@/components/ExchangeLogos';
import UpdatedAgo from '@/components/UpdatedAgo';
import SoftAuthGate, { useAuthLimit } from '@/components/SoftAuthGate';
import { useApi } from '@/hooks/useSWRApi';
import { formatPrice } from '@/lib/utils/format';
import {
  ArrowLeftRight, Search, ArrowUpDown, TrendingUp, TrendingDown,
  BarChart3, Activity, Zap, Info,
} from 'lucide-react';

/* ─── Types ──────────────────────────────────────────────────────── */

interface TickerRow {
  symbol: string;
  exchange: string;
  lastPrice: number;
  volume24h: number;
  quoteVolume24h: number;
}

interface SpreadRow {
  symbol: string;
  exchanges: number;
  medianPrice: number;
  highExchange: string;
  highPrice: number;
  lowExchange: string;
  lowPrice: number;
  spreadBps: number;
  spreadPct: number;
  totalVolume: number;
  tickers: { exchange: string; price: number; deviation: number }[];
}

type SortField = 'symbol' | 'spreadBps' | 'exchanges' | 'medianPrice' | 'totalVolume';
type SortOrder = 'asc' | 'desc';

const ROWS_PER_PAGE = 40;

/* ─── Helpers ────────────────────────────────────────────────────── */

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function buildSpreads(tickers: TickerRow[]): SpreadRow[] {
  // Group by symbol
  const bySymbol = new Map<string, TickerRow[]>();
  for (const t of tickers) {
    if (!t.lastPrice || t.lastPrice <= 0) continue;
    const sym = t.symbol;
    if (!bySymbol.has(sym)) bySymbol.set(sym, []);
    bySymbol.get(sym)!.push(t);
  }

  const results: SpreadRow[] = [];
  for (const [symbol, entries] of Array.from(bySymbol)) {
    // Need at least 2 exchanges to compute spread
    // Deduplicate by exchange (keep highest volume)
    const byExchange = new Map<string, TickerRow>();
    for (const e of entries) {
      const existing = byExchange.get(e.exchange);
      if (!existing || e.quoteVolume24h > existing.quoteVolume24h) {
        byExchange.set(e.exchange, e);
      }
    }
    const deduped = Array.from(byExchange.values());
    if (deduped.length < 2) continue;

    const prices = deduped.map(e => e.lastPrice);
    const med = median(prices);
    if (med <= 0) continue;

    // Filter out outlier prices (>20% away from median = likely different contract spec or stale)
    const MAX_DEVIATION = 0.2; // 20%
    const sane = deduped.filter(e => Math.abs(e.lastPrice - med) / med <= MAX_DEVIATION);
    if (sane.length < 2) continue;

    // Recalculate median with sane prices only
    const saneMed = median(sane.map(e => e.lastPrice));
    if (saneMed <= 0) continue;

    const tickerData = sane
      .map(e => ({
        exchange: e.exchange,
        price: e.lastPrice,
        deviation: ((e.lastPrice - saneMed) / saneMed) * 10000, // bps
      }))
      .sort((a, b) => b.deviation - a.deviation);

    const high = tickerData[0];
    const low = tickerData[tickerData.length - 1];
    const spreadBps = high.deviation - low.deviation;
    const totalVolume = sane.reduce((s, e) => s + (e.quoteVolume24h || 0), 0);

    results.push({
      symbol,
      exchanges: sane.length,
      medianPrice: saneMed,
      highExchange: high.exchange,
      highPrice: high.price,
      lowExchange: low.exchange,
      lowPrice: low.price,
      spreadBps,
      spreadPct: spreadBps / 100,
      totalVolume,
      tickers: tickerData,
    });
  }

  return results;
}

/* ─── Stats Card ─────────────────────────────────────────────────── */

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: any; label: string; value: string; sub?: string; color: string;
}) {
  return (
    <div className="relative group rounded-xl overflow-hidden"
      style={{ background: `linear-gradient(135deg, ${color}10 0%, var(--hub-darker) 60%)`, border: `1px solid ${color}20` }}>
      <div className="relative px-4 py-3.5">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-neutral-500 text-[10px] font-semibold uppercase tracking-[0.1em]">{label}</span>
          <Icon className="w-3.5 h-3.5" style={{ color, opacity: 0.4 }} />
        </div>
        <div className="text-2xl font-black text-white font-mono tracking-tight">{value}</div>
        {sub && <span className="text-neutral-600 text-[9px] mt-1 block">{sub}</span>}
      </div>
    </div>
  );
}

/* ─── Expanded Row ───────────────────────────────────────────────── */

function ExpandedRow({ row }: { row: SpreadRow }) {
  const maxDev = Math.max(...row.tickers.map(t => Math.abs(t.deviation)), 1);
  return (
    <tr>
      <td colSpan={7} className="px-0 py-0">
        <div className="bg-white/[0.02] border-t border-b border-white/[0.04] px-4 py-3">
          <div className="text-[10px] text-neutral-500 uppercase tracking-wider mb-2 font-semibold">
            Price by Exchange (deviation from median in bps)
          </div>
          <div className="space-y-1">
            {row.tickers.map(t => (
              <div key={t.exchange} className="flex items-center gap-2">
                <div className="w-20 flex items-center gap-1.5 flex-shrink-0">
                  <ExchangeLogo exchange={t.exchange.toLowerCase()} size={14} />
                  <span className="text-[11px] text-neutral-400 truncate">{t.exchange}</span>
                </div>
                <div className="flex-1 flex items-center gap-2">
                  <div className="flex-1 h-4 relative bg-white/[0.03] rounded overflow-hidden">
                    {/* Center line */}
                    <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/[0.1]" />
                    {/* Bar */}
                    <div
                      className="absolute top-0.5 bottom-0.5 rounded-sm"
                      style={{
                        left: t.deviation >= 0 ? '50%' : `${50 - (Math.abs(t.deviation) / maxDev) * 45}%`,
                        width: `${(Math.abs(t.deviation) / maxDev) * 45}%`,
                        background: t.deviation >= 0 ? '#22c55e' : '#ef4444',
                        opacity: 0.7,
                      }}
                    />
                  </div>
                  <span className={`text-[11px] font-mono w-16 text-right ${t.deviation >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {t.deviation >= 0 ? '+' : ''}{t.deviation.toFixed(1)}
                  </span>
                </div>
                <span className="text-[11px] font-mono text-neutral-400 w-24 text-right">{formatPrice(t.price)}</span>
              </div>
            ))}
          </div>
        </div>
      </td>
    </tr>
  );
}

/* ─── Main Page ──────────────────────────────────────────────────── */

export default function SpreadsPage() {
  const { data, isLoading, lastUpdate } = useApi<TickerRow[]>({
    key: 'tickers-spreads',
    fetcher: async () => {
      const res = await fetch('/api/tickers');
      if (!res.ok) throw new Error('Failed to fetch tickers');
      const json = await res.json();
      return json.data ?? json;
    },
    refreshInterval: 30_000,
  });

  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('spreadBps');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null);
  const [minExchanges, setMinExchanges] = useState(3);

  const authLimit = useAuthLimit(20);

  const allSpreads = useMemo(() => {
    if (!data) return [];
    return buildSpreads(data);
  }, [data]);

  const filtered = useMemo(() => {
    let rows = allSpreads.filter(r => r.exchanges >= minExchanges);
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(r =>
        r.symbol.toLowerCase().includes(q) ||
        r.highExchange.toLowerCase().includes(q) ||
        r.lowExchange.toLowerCase().includes(q)
      );
    }
    rows.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'symbol': cmp = a.symbol.localeCompare(b.symbol); break;
        case 'spreadBps': cmp = a.spreadBps - b.spreadBps; break;
        case 'exchanges': cmp = a.exchanges - b.exchanges; break;
        case 'medianPrice': cmp = a.medianPrice - b.medianPrice; break;
        case 'totalVolume': cmp = a.totalVolume - b.totalVolume; break;
      }
      return sortOrder === 'desc' ? -cmp : cmp;
    });
    return rows;
  }, [allSpreads, search, sortField, sortOrder, minExchanges]);

  const displayData = authLimit ? filtered.slice(0, authLimit) : filtered;
  const totalPages = Math.max(1, Math.ceil(displayData.length / ROWS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const startIdx = (safePage - 1) * ROWS_PER_PAGE;
  const pageData = displayData.slice(startIdx, startIdx + ROWS_PER_PAGE);

  // Stats
  const avgSpread = allSpreads.length > 0
    ? allSpreads.reduce((s, r) => s + r.spreadBps, 0) / allSpreads.length : 0;
  const maxSpreadRow = allSpreads.length > 0
    ? allSpreads.reduce((max, r) => r.spreadBps > max.spreadBps ? r : max, allSpreads[0]) : null;
  const wideSpreadCount = allSpreads.filter(r => r.spreadBps >= 10).length;

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(o => o === 'desc' ? 'asc' : 'desc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
    setCurrentPage(1);
  };

  const SortIcon = ({ field }: { field: SortField }) => (
    <ArrowUpDown className={`w-3 h-3 inline ml-0.5 ${sortField === field ? 'text-hub-yellow' : 'text-neutral-700'}`} />
  );

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-20 pb-10">
        {/* Title */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-hub-yellow/10 border border-hub-yellow/20 flex items-center justify-center">
              <ArrowLeftRight className="w-4 h-4 text-hub-yellow" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white">Price Spreads</h1>
              <p className="text-neutral-500 text-xs">Cross-exchange price deviations in real-time</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <UpdatedAgo date={lastUpdate} />
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-5">
          <StatCard icon={BarChart3} label="Symbols" value={allSpreads.length.toLocaleString()}
            sub={`${minExchanges}+ exchanges`} color="#FFA500" />
          <StatCard icon={Activity} label="Avg Spread" value={`${avgSpread.toFixed(1)} bps`}
            sub="Across all pairs" color="#8b5cf6" />
          <StatCard icon={Zap} label="Wide Spreads" value={wideSpreadCount.toString()}
            sub="> 10 bps" color="#ef4444" />
          {maxSpreadRow && (
            <StatCard icon={TrendingUp} label="Widest Spread"
              value={`${maxSpreadRow.spreadBps.toFixed(1)} bps`}
              sub={maxSpreadRow.symbol} color="#22c55e" />
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-600" />
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
              placeholder="Search symbol or exchange..."
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-xs placeholder-neutral-600 focus:outline-none focus:border-hub-yellow/40"
            />
          </div>
          <div className="flex items-center gap-1.5 text-[11px]">
            <span className="text-neutral-500">Min exchanges:</span>
            {[2, 3, 5, 8].map(n => (
              <button
                key={n}
                onClick={() => { setMinExchanges(n); setCurrentPage(1); }}
                className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                  minExchanges === n
                    ? 'bg-hub-yellow/15 text-hub-yellow border border-hub-yellow/30'
                    : 'bg-white/[0.04] text-neutral-500 border border-white/[0.06] hover:text-white'
                }`}
              >
                {n}+
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 text-[10px] text-neutral-600">
            <Info className="w-3 h-3" />
            <span>Spread = highest - lowest price deviation from median (bps)</span>
          </div>
        </div>

        {/* Table */}
        <div className="bg-hub-darker border border-white/[0.06] rounded-2xl overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-neutral-500 text-sm">Loading ticker data...</div>
          ) : pageData.length === 0 ? (
            <div className="p-8 text-center text-neutral-600 text-sm">
              No spreads found{search ? ` for "${search}"` : ''}.
            </div>
          ) : (
            <div className="overflow-x-auto scrollbar-accent">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/[0.06] text-[10px] text-neutral-500 uppercase tracking-wider">
                    <th className="px-4 py-3 font-semibold">#</th>
                    <th className="px-4 py-3 font-semibold cursor-pointer hover:text-white" onClick={() => toggleSort('symbol')}>
                      Symbol <SortIcon field="symbol" />
                    </th>
                    <th className="px-4 py-3 font-semibold cursor-pointer hover:text-white text-right" onClick={() => toggleSort('spreadBps')}>
                      Spread <SortIcon field="spreadBps" />
                    </th>
                    <th className="px-4 py-3 font-semibold text-right">Highest</th>
                    <th className="px-4 py-3 font-semibold text-right">Lowest</th>
                    <th className="px-4 py-3 font-semibold cursor-pointer hover:text-white text-right" onClick={() => toggleSort('exchanges')}>
                      Exchanges <SortIcon field="exchanges" />
                    </th>
                    <th className="px-4 py-3 font-semibold cursor-pointer hover:text-white text-right" onClick={() => toggleSort('totalVolume')}>
                      Volume <SortIcon field="totalVolume" />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pageData.map((row, idx) => {
                    const rank = startIdx + idx + 1;
                    const isExpanded = expandedSymbol === row.symbol;
                    const spreadColor = row.spreadBps >= 20 ? 'text-hub-yellow'
                      : row.spreadBps >= 10 ? 'text-red-400'
                      : row.spreadBps >= 5 ? 'text-orange-400'
                      : 'text-neutral-400';
                    const spreadGlow = row.spreadBps >= 20
                      ? { textShadow: '0 0 8px rgba(255,165,0,0.4)' }
                      : row.spreadBps >= 10
                      ? { textShadow: '0 0 6px rgba(239,68,94,0.3)' }
                      : undefined;

                    return (
                      <React.Fragment key={row.symbol}>
                        <tr
                          className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors cursor-pointer"
                          onClick={() => setExpandedSymbol(isExpanded ? null : row.symbol)}
                        >
                          <td className="px-4 py-2.5 text-[11px] text-neutral-600 font-mono">{rank}</td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <TokenIconSimple symbol={row.symbol} size={18} />
                              <span className="text-white text-xs font-semibold">{row.symbol}</span>
                              <span className="text-[10px] text-neutral-600 font-mono">{formatPrice(row.medianPrice)}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <span className={`font-mono text-sm font-bold ${spreadColor}`} style={spreadGlow}>
                              {row.spreadBps.toFixed(1)}
                            </span>
                            <span className="text-[9px] text-neutral-600 ml-1">bps</span>
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <ExchangeLogo exchange={row.highExchange.toLowerCase()} size={13} />
                              <span className="text-[11px] text-green-400 font-mono">{formatPrice(row.highPrice)}</span>
                            </div>
                            <span className="text-[9px] text-neutral-600">{row.highExchange}</span>
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <ExchangeLogo exchange={row.lowExchange.toLowerCase()} size={13} />
                              <span className="text-[11px] text-red-400 font-mono">{formatPrice(row.lowPrice)}</span>
                            </div>
                            <span className="text-[9px] text-neutral-600">{row.lowExchange}</span>
                          </td>
                          <td className="px-4 py-2.5 text-right text-xs text-neutral-400 font-mono">{row.exchanges}</td>
                          <td className="px-4 py-2.5 text-right text-xs text-neutral-400 font-mono">
                            ${row.totalVolume >= 1e9 ? (row.totalVolume / 1e9).toFixed(1) + 'B'
                              : row.totalVolume >= 1e6 ? (row.totalVolume / 1e6).toFixed(1) + 'M'
                              : row.totalVolume >= 1e3 ? (row.totalVolume / 1e3).toFixed(0) + 'K'
                              : row.totalVolume.toFixed(0)}
                          </td>
                        </tr>
                        {isExpanded && <ExpandedRow row={row} />}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Info footer */}
        <div className="mt-6 p-4 rounded-2xl bg-hub-yellow/5 border border-hub-yellow/10 border-l-2 border-l-hub-yellow/40">
          <p className="text-neutral-300 text-xs leading-relaxed flex items-start gap-2.5">
            <Info className="w-4 h-4 text-hub-yellow mt-0.5 flex-shrink-0" />
            <span>
              <span className="text-hub-yellow font-medium">Spread</span> = difference between the highest and lowest exchange price for a symbol, measured in basis points (bps). 1 bps = 0.01%.
              Prices that deviate &gt;50% from the median are excluded as outliers (different contract specs).
              High spreads may indicate arbitrage opportunities or low liquidity on certain exchanges.
            </span>
          </p>
          <p className="text-[10px] text-neutral-500 mt-2 ml-6">
            Sources: Binance, Bybit, OKX, Bitget, MEXC, Kraken, BingX, Phemex, Bitunix, KuCoin, HTX, Bitfinex, CoinEx, Deribit, Hyperliquid, dYdX, and more. Refreshes every 30s.
          </p>
        </div>

        {authLimit && filtered.length > authLimit && (
          <SoftAuthGate freeLimit={authLimit} totalCount={filtered.length} dataLabel="pairs" />
        )}

        {displayData.length > ROWS_PER_PAGE && (
          <Pagination
            currentPage={safePage}
            totalPages={totalPages}
            totalItems={displayData.length}
            rowsPerPage={ROWS_PER_PAGE}
            onPageChange={setCurrentPage}
            label="pairs"
          />
        )}
      </main>
      <Footer />
    </div>
  );
}

