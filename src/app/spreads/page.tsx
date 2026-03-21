'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
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
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer,
  ScatterChart, Scatter, CartesianGrid, ZAxis, Cell,
  LineChart, Line, Legend,
} from 'recharts';

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

    // Filter out outlier prices (>10% away from median = likely different contract spec or stale)
    const MAX_DEVIATION = 0.1; // 10%
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

/* ─── Spread History Chart (Session) ────────────────────────────── */

const ALL_CHART_COLORS = ['#F59E0B', '#8B5CF6', '#22C55E', '#ef4444', '#06B6D4', '#EC4899', '#F97316', '#14B8A6'];
const DEFAULT_COINS = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'LINK', 'AVAX', 'ADA'];
// Popular coins shown first in picker
const POPULAR_COINS = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'LINK', 'AVAX', 'ADA', 'DOT', 'MATIC',
  'UNI', 'AAVE', 'ARB', 'OP', 'SUI', 'APT', 'NEAR', 'FIL', 'ATOM', 'INJ',
  'WLD', 'PEPE', 'BONK', 'HBAR', 'LTC', 'BCH', 'ETC', 'FTM', 'RENDER', 'TIA'];

function SpreadHistoryChart({ history, allSymbols, selectedCoins, onToggleCoin }: {
  history: { time: number; [k: string]: number }[];
  allSymbols: string[];
  selectedCoins: string[];
  onToggleCoin: (sym: string) => void;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const [coinSearch, setCoinSearch] = useState('');

  const filteredSymbols = useMemo(() => {
    const available = new Set(allSymbols);
    let sorted: string[];
    if (coinSearch) {
      sorted = allSymbols.filter(s => s.toLowerCase().includes(coinSearch.toLowerCase()));
    } else {
      // Popular coins first, then alphabetical
      const popular = POPULAR_COINS.filter(s => available.has(s));
      const rest = allSymbols.filter(s => !POPULAR_COINS.includes(s));
      sorted = [...popular, ...rest];
    }
    return sorted.slice(0, 40);
  }, [allSymbols, coinSearch]);

  const colorMap = Object.fromEntries(selectedCoins.map((s, i) => [s, ALL_CHART_COLORS[i % ALL_CHART_COLORS.length]]));

  return (
    <div className="bg-hub-darker border border-white/[0.06] rounded-2xl p-4 mb-5">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-white">Spread History</h3>
          <span className="text-[8px] px-1.5 py-[1px] rounded bg-white/[0.06] text-neutral-500">SESSION</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-neutral-600">{history.length} pts</span>
          <div className="relative">
            <button
              onClick={() => setShowPicker(!showPicker)}
              className="text-[9px] px-2 py-1 rounded bg-hub-yellow/10 text-hub-yellow border border-hub-yellow/20 hover:bg-hub-yellow/20 transition-colors"
            >
              + Coins ({selectedCoins.length})
            </button>
            {showPicker && (
              <div className="absolute right-0 top-full mt-1 z-50 w-48 max-h-52 overflow-y-auto rounded-lg bg-[#1a1a1a] border border-white/10 shadow-2xl">
                <div className="sticky top-0 bg-[#1a1a1a] p-1.5 border-b border-white/[0.06]">
                  <input
                    type="text" value={coinSearch} onChange={e => setCoinSearch(e.target.value)}
                    placeholder="Search..." autoFocus
                    className="w-full px-2 py-1 rounded bg-white/[0.04] border border-white/[0.08] text-white text-[10px] placeholder-neutral-600 focus:outline-none"
                  />
                </div>
                {!coinSearch && <div className="px-3 py-1 text-[8px] text-neutral-600 uppercase tracking-wider font-semibold">Popular</div>}
                {filteredSymbols.map((s, i) => (
                  <React.Fragment key={s}>
                    {!coinSearch && i === POPULAR_COINS.filter(p => allSymbols.includes(p)).length && (
                      <div className="px-3 py-1 text-[8px] text-neutral-600 uppercase tracking-wider font-semibold border-t border-white/[0.04] mt-1 pt-1">All</div>
                    )}
                    <button onClick={() => onToggleCoin(s)}
                      className={`w-full text-left px-3 py-1.5 text-[10px] hover:bg-white/[0.04] flex items-center justify-between ${
                        selectedCoins.includes(s) ? 'text-hub-yellow' : 'text-neutral-400'
                      }`}>
                      <span>{s}</span>
                      {selectedCoins.includes(s) && <span className="text-hub-yellow">✓</span>}
                    </button>
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Selected coin chips */}
      <div className="flex flex-wrap gap-1 mb-2">
        {selectedCoins.map((s, i) => (
          <button key={s} onClick={() => onToggleCoin(s)}
            className="flex items-center gap-1 px-1.5 py-[2px] rounded text-[9px] font-semibold border transition-colors hover:opacity-80"
            style={{ borderColor: colorMap[s] + '40', color: colorMap[s], background: colorMap[s] + '15' }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: colorMap[s] }} />
            {s}
            <span className="text-neutral-600 ml-0.5">×</span>
          </button>
        ))}
      </div>

      {history.length < 2 ? (
        <div className="h-[160px] flex items-center justify-center text-neutral-600 text-xs">
          Accumulating data... ({history.length}/2 points, updates every 30s)
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={history.map(h => ({
            ...h,
            label: new Date(h.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          }))} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="label" tick={{ fill: '#525252', fontSize: 9 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#525252', fontSize: 9 }} axisLine={false} tickLine={false} unit=" bps" />
            <RTooltip
              contentStyle={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: 11 }}
              labelStyle={{ color: '#737373', fontSize: 10 }}
              formatter={(v: number, name: string) => [`${v.toFixed(1)} bps`, name]}
            />
            {selectedCoins.map(sym => (
              <Line key={sym} type="stepAfter" dataKey={sym} stroke={colorMap[sym]} strokeWidth={2} dot={false} connectNulls />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
      <p className="text-[8px] text-neutral-600 mt-1 text-center">Session data only, clears on refresh</p>
    </div>
  );
}

/* ─── Spread Charts (Recharts) ──────────────────────────────────── */

function SpreadCharts({ data }: { data: SpreadRow[] }) {
  // Distribution histogram buckets
  const buckets = [
    { label: '0-5', min: 0, max: 5 },
    { label: '5-10', min: 5, max: 10 },
    { label: '10-25', min: 10, max: 25 },
    { label: '25-50', min: 25, max: 50 },
    { label: '50-100', min: 50, max: 100 },
    { label: '100-500', min: 100, max: 500 },
    { label: '500+', min: 500, max: Infinity },
  ];

  const distData = buckets.map(b => ({
    range: b.label,
    count: data.filter(r => r.spreadBps >= b.min && r.spreadBps < b.max).length,
    color: b.min >= 500 ? '#ef4444' : b.min >= 100 ? '#f97316' : b.min >= 25 ? '#eab308' : '#22c55e',
  }));

  // Scatter: spread vs volume (top 50 by volume, 5+ exchanges)
  const scatterData = data
    .filter(r => r.exchanges >= 5 && r.totalVolume > 0)
    .sort((a, b) => b.totalVolume - a.totalVolume)
    .slice(0, 50)
    .map(r => ({
      symbol: r.symbol,
      spread: r.spreadBps,
      volume: r.totalVolume,
      exchanges: r.exchanges,
    }));

  const fmtVol = (v: number) => {
    if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
    if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
    if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
    return `$${v.toFixed(0)}`;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-5">
      {/* Distribution */}
      <div className="bg-hub-darker border border-white/[0.06] rounded-2xl p-4">
        <h3 className="text-sm font-semibold text-white mb-1">Spread Distribution</h3>
        <p className="text-[9px] text-neutral-600 mb-3">Number of pairs by spread range (bps)</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={distData} margin={{ top: 15, right: 10, bottom: 0, left: -10 }}>
            <XAxis dataKey="range" tick={{ fill: '#737373', fontSize: 9 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#525252', fontSize: 9 }} axisLine={false} tickLine={false} />
            <RTooltip
              contentStyle={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: 11, padding: '8px 12px' }}
              labelStyle={{ color: '#eab308', fontWeight: 600 }}
              formatter={(v: number) => [`${v} pairs`, '']}
              labelFormatter={(l) => `${l} bps`}
              separator=""
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={45} label={{ position: 'top', fill: '#737373', fontSize: 9 }}>
              {distData.map((entry, i) => (
                <Cell key={i} fill={entry.color} fillOpacity={0.75} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Scatter: Spread vs Volume */}
      <div className="bg-hub-darker border border-white/[0.06] rounded-2xl p-4">
        <h3 className="text-sm font-semibold text-white mb-1">Spread vs Volume</h3>
        <p className="text-[9px] text-neutral-600 mb-3">Top 50 by volume (5+ exchanges). Dot size = exchange count</p>
        <ResponsiveContainer width="100%" height={180}>
          <ScatterChart margin={{ top: 5, right: 5, bottom: 0, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis
              type="number" dataKey="volume" name="Volume"
              tick={{ fill: '#525252', fontSize: 9 }} axisLine={false} tickLine={false}
              tickFormatter={fmtVol} scale="log" domain={['auto', 'auto']}
            />
            <YAxis
              type="number" dataKey="spread" name="Spread"
              tick={{ fill: '#525252', fontSize: 9 }} axisLine={false} tickLine={false}
              unit=" bps"
            />
            <ZAxis type="number" dataKey="exchanges" range={[20, 200]} />
            <RTooltip
              contentStyle={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: 11 }}
              formatter={(v: number, name: string) => [
                name === 'Volume' ? fmtVol(v) : `${v.toFixed(1)} bps`,
                name,
              ]}
              labelFormatter={() => ''}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0]?.payload;
                return (
                  <div className="bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 shadow-xl">
                    <p className="text-white font-bold text-xs">{d.symbol}</p>
                    <p className="text-neutral-400 text-[10px]">Spread: <span className="text-hub-yellow font-mono">{d.spread.toFixed(1)} bps</span></p>
                    <p className="text-neutral-400 text-[10px]">Volume: <span className="text-white font-mono">{fmtVol(d.volume)}</span></p>
                    <p className="text-neutral-400 text-[10px]">Exchanges: <span className="text-white">{d.exchanges}</span></p>
                  </div>
                );
              }}
            />
            <Scatter data={scatterData}>
              {scatterData.map((entry, i) => (
                <Cell
                  key={i}
                  fill={entry.spread >= 500 ? '#ef4444' : entry.spread >= 100 ? '#f97316' : entry.spread >= 25 ? '#eab308' : '#22c55e'}
                  fillOpacity={0.7}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ─── Top Spreads Chart ─────────────────────────────────────────── */

function TopSpreadsChart({ data }: { data: SpreadRow[] }) {
  const top10 = data
    .filter(r => r.exchanges >= 3)
    .sort((a, b) => b.spreadBps - a.spreadBps)
    .slice(0, 12);
  if (top10.length === 0) return null;

  const maxBps = Math.max(...top10.map(r => r.spreadBps), 1);

  return (
    <div className="bg-hub-darker border border-white/[0.06] rounded-2xl p-4 mb-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-white">Widest Spreads</h2>
        <span className="text-[9px] text-neutral-600">3+ exchanges, sorted by spread</span>
      </div>
      <div className="space-y-1.5">
        {top10.map((row, i) => {
          const pct = (row.spreadBps / maxBps) * 100;
          const isHot = row.spreadBps >= 500;
          const isWarm = row.spreadBps >= 100;
          const barColor = isHot ? 'bg-red-500/70' : isWarm ? 'bg-orange-500/60' : 'bg-hub-yellow/50';
          const textColor = isHot ? 'text-red-400' : isWarm ? 'text-orange-400' : 'text-hub-yellow';
          return (
            <div key={row.symbol} className="flex items-center gap-2 group">
              <span className="w-4 text-[9px] text-neutral-600 text-right font-mono">{i + 1}</span>
              <div className="w-14 flex items-center gap-1 flex-shrink-0">
                <TokenIconSimple symbol={row.symbol} size={14} />
                <span className="text-[11px] text-white font-semibold truncate">{row.symbol}</span>
              </div>
              <div className="flex-1 h-5 relative bg-white/[0.03] rounded overflow-hidden">
                <div
                  className={`absolute inset-y-0 left-0 ${barColor} rounded transition-all group-hover:opacity-90`}
                  style={{ width: `${Math.max(pct, 2)}%` }}
                />
                <div className="absolute inset-0 flex items-center px-2">
                  <span className={`text-[9px] font-mono font-bold ${textColor}`}>
                    {row.spreadBps.toFixed(0)} bps
                  </span>
                </div>
              </div>
              <div className="w-24 text-right flex-shrink-0 hidden sm:block">
                <span className="text-[9px] text-green-400/70 font-mono">{row.highExchange}</span>
                <span className="text-[9px] text-neutral-600 mx-1">→</span>
                <span className="text-[9px] text-red-400/70 font-mono">{row.lowExchange}</span>
              </div>
              <span className="w-8 text-[9px] text-neutral-600 text-right font-mono flex-shrink-0">{row.exchanges}x</span>
            </div>
          );
        })}
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
    refreshInterval: 15_000,
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

  // Track spread history for selected symbols (session only)
  const [selectedCoins, setSelectedCoins] = useState<string[]>(DEFAULT_COINS);
  const historyRef = useRef<{ time: number; [key: string]: number }[]>([]);
  const [spreadHistory, setSpreadHistory] = useState<{ time: number; [key: string]: number }[]>([]);

  // All available symbols with 3+ exchanges for the picker
  const availableSymbols = useMemo(() =>
    allSpreads.filter(r => r.exchanges >= 3).map(r => r.symbol).sort(),
    [allSpreads]
  );

  const toggleCoin = (sym: string) => {
    setSelectedCoins(prev =>
      prev.includes(sym) ? prev.filter(s => s !== sym) : prev.length < 8 ? [...prev, sym] : prev
    );
  };

  useEffect(() => {
    if (allSpreads.length === 0) return;
    const now = Date.now();
    const point: { time: number; [key: string]: number } = { time: now };
    // Track all symbols that have ever been selected (so history persists when toggling)
    const allTracked = Array.from(new Set([...selectedCoins, ...Object.keys(historyRef.current[0] || {}).filter(k => k !== 'time')]));
    for (const sym of allTracked) {
      const row = allSpreads.find(r => r.symbol === sym);
      if (row) point[sym] = parseFloat(row.spreadBps.toFixed(1));
    }
    if (Object.keys(point).length > 1) {
      const last = historyRef.current[historyRef.current.length - 1];
      if (!last || now - last.time > 10000) {
        historyRef.current.push(point);
        if (historyRef.current.length > 120) historyRef.current.shift();
        setSpreadHistory([...historyRef.current]);
      }
    }
  }, [allSpreads, selectedCoins]);

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

        {/* Spread History (session) */}
        {!isLoading && <SpreadHistoryChart history={spreadHistory} allSymbols={availableSymbols} selectedCoins={selectedCoins} onToggleCoin={toggleCoin} />}

        {/* Spread Charts */}
        {!isLoading && allSpreads.length > 0 && <SpreadCharts data={allSpreads} />}

        {/* Top Spreads Bar */}
        {!isLoading && allSpreads.length > 0 && <TopSpreadsChart data={allSpreads} />}

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

