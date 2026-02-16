'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useApiData } from '@/hooks/useApiData';
import { RefreshCw, Plus, X, Edit2, Trash2, AlertTriangle } from 'lucide-react';
import { formatUSD, formatPercent, formatQty, formatPrice } from '@/lib/utils/format';
import { TokenIconSimple } from '@/components/TokenIcon';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import {
  getHoldings,
  addHolding,
  updateHolding,
  removeHolding,
  Holding,
} from '@/lib/storage/portfolio';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Ticker {
  symbol: string;
  lastPrice: number;
  priceChangePercent24h: number;
  volume24h: number;
  exchange: string;
}

type SortKey = 'value' | 'pnl' | 'allocation';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const PIE_COLORS = [
  '#FFA500', '#3b82f6', '#22c55e', '#ef4444', '#a855f7',
  '#eab308', '#06b6d4', '#f97316', '#ec4899', '#14b8a6',
  '#8b5cf6', '#64748b', '#d946ef', '#84cc16', '#f43f5e',
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function PortfolioPage() {
  // ----- state -----
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editSymbol, setEditSymbol] = useState<string | null>(null);
  const [formSymbol, setFormSymbol] = useState('');
  const [formQty, setFormQty] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('value');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Load holdings from localStorage on mount
  useEffect(() => {
    setHoldings(getHoldings());
  }, []);

  // ----- ticker data -----
  const fetcher = useCallback(async () => {
    const res = await fetch('/api/tickers');
    if (!res.ok) throw new Error('Failed to fetch tickers');
    return (await res.json()) as Ticker[];
  }, []);

  const { data: tickers, isLoading, isRefreshing, lastUpdate, refresh, error: priceError } = useApiData<Ticker[]>({
    fetcher,
    refreshInterval: 60_000, // 60s (was 30s)
  });

  // ----- price map: symbol -> best-volume ticker -----
  const priceMap = useMemo(() => {
    const map = new Map<string, Ticker>();
    if (!tickers) return map;
    for (const t of tickers) {
      const sym = t.symbol.toUpperCase();
      const existing = map.get(sym);
      if (!existing || t.volume24h > existing.volume24h) {
        map.set(sym, t);
      }
    }
    return map;
  }, [tickers]);

  // ----- enriched holdings -----
  const enriched = useMemo(() => {
    return holdings.map((h) => {
      const ticker = priceMap.get(h.symbol);
      const currentPrice = ticker?.lastPrice ?? 0;
      const value = currentPrice * h.quantity;
      const costBasis = h.avgPrice * h.quantity;
      const pnl = value - costBasis;
      const pnlPct = costBasis > 0 ? (pnl / costBasis) * 100 : 0;
      return { ...h, currentPrice, value, costBasis, pnl, pnlPct };
    });
  }, [holdings, priceMap]);

  // ----- portfolio totals -----
  const totals = useMemo(() => {
    const totalValue = enriched.reduce((s, h) => s + h.value, 0);
    const totalCost = enriched.reduce((s, h) => s + h.costBasis, 0);
    const totalPnl = totalValue - totalCost;
    const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

    let best = enriched[0] ?? null;
    let worst = enriched[0] ?? null;
    for (const h of enriched) {
      if (h.pnlPct > (best?.pnlPct ?? -Infinity)) best = h;
      if (h.pnlPct < (worst?.pnlPct ?? Infinity)) worst = h;
    }

    return { totalValue, totalCost, totalPnl, totalPnlPct, best, worst };
  }, [enriched]);

  // ----- sorted holdings -----
  const sorted = useMemo(() => {
    const copy = [...enriched];
    const dir = sortDir === 'desc' ? -1 : 1;
    copy.sort((a, b) => {
      const totalVal = totals.totalValue || 1;
      switch (sortKey) {
        case 'value':
          return (a.value - b.value) * dir;
        case 'pnl':
          return (a.pnlPct - b.pnlPct) * dir;
        case 'allocation':
          return ((a.value / totalVal) - (b.value / totalVal)) * dir;
        default:
          return 0;
      }
    });
    return copy;
  }, [enriched, sortKey, sortDir, totals.totalValue]);

  // ----- pie chart data -----
  const pieData = useMemo(() => {
    if (totals.totalValue === 0) return [];
    return enriched
      .filter((h) => h.value > 0)
      .sort((a, b) => b.value - a.value)
      .map((h) => ({
        name: h.symbol,
        value: h.value,
        pct: (h.value / totals.totalValue) * 100,
      }));
  }, [enriched, totals.totalValue]);

  // ----- handlers -----
  const reloadHoldings = () => setHoldings(getHoldings());

  const openAddModal = () => {
    setEditSymbol(null);
    setFormSymbol('');
    setFormQty('');
    setFormPrice('');
    setShowModal(true);
  };

  const openEditModal = (h: Holding) => {
    setEditSymbol(h.symbol);
    setFormSymbol(h.symbol);
    setFormQty(String(h.quantity));
    setFormPrice(String(h.avgPrice));
    setShowModal(true);
  };

  const handleSubmit = () => {
    const qty = parseFloat(formQty);
    const price = parseFloat(formPrice);
    if (!formSymbol.trim() || isNaN(qty) || qty <= 0 || isNaN(price) || price <= 0) return;

    if (editSymbol) {
      updateHolding(editSymbol, { quantity: qty, avgPrice: price });
    } else {
      addHolding({ symbol: formSymbol.toUpperCase().trim(), quantity: qty, avgPrice: price });
    }
    reloadHoldings();
    setShowModal(false);
  };

  const handleRemove = (symbol: string) => {
    removeHolding(symbol);
    reloadHoldings();
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  // ----- render -----
  return (
    <div className="min-h-screen bg-hub-black text-white">
      <Header />

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        {/* Page header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold">Portfolio Tracker</h1>
            <p className="text-neutral-500 text-sm mt-1">
              Track your holdings and unrealised P&amp;L in real time
            </p>
          </div>

          <div className="flex items-center gap-3">
            {lastUpdate && (
              <span className="text-neutral-600 text-xs font-mono">
                {lastUpdate.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={refresh}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-neutral-400 hover:text-white transition-colors text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={openAddModal}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-hub-yellow text-black font-semibold text-xs hover:brightness-110 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Position
            </button>
          </div>
        </div>

        {priceError && (
          <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3 mb-4 flex items-center gap-2 text-red-400 text-sm">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {priceError}
          </div>
        )}

        {/* Empty state */}
        {holdings.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-full bg-hub-yellow/10 flex items-center justify-center mb-4">
              <Plus className="w-8 h-8 text-hub-yellow" />
            </div>
            <h2 className="text-lg font-semibold mb-2">No positions yet</h2>
            <p className="text-neutral-500 text-sm mb-6 max-w-sm">
              Add your first position to start tracking your portfolio performance and P&amp;L.
            </p>
            <button
              onClick={openAddModal}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-hub-yellow text-black font-semibold text-sm hover:brightness-110 transition"
            >
              <Plus className="w-4 h-4" />
              Add Position
            </button>
          </div>
        )}

        {/* Summary cards + pie */}
        {holdings.length > 0 && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
              {/* Total Value */}
              <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-4">
                <p className="text-neutral-500 text-xs mb-1">Total Value</p>
                <p className="text-xl font-bold font-mono">
                  {formatUSD(totals.totalValue)}
                </p>
              </div>

              {/* Total P&L */}
              <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-4">
                <p className="text-neutral-500 text-xs mb-1">Total P&amp;L</p>
                <p
                  className={`text-xl font-bold font-mono ${
                    totals.totalPnl >= 0 ? 'text-green-500' : 'text-red-500'
                  }`}
                >
                  {totals.totalPnl >= 0 ? '+' : ''}{formatUSD(totals.totalPnl)}
                </p>
              </div>

              {/* Total P&L % */}
              <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-4">
                <p className="text-neutral-500 text-xs mb-1">Total P&amp;L %</p>
                <p
                  className={`text-xl font-bold font-mono ${
                    totals.totalPnlPct >= 0 ? 'text-green-500' : 'text-red-500'
                  }`}
                >
                  {formatPercent(totals.totalPnlPct)}
                </p>
              </div>

              {/* Best Performer */}
              <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-4">
                <p className="text-neutral-500 text-xs mb-1">Best Performer</p>
                {totals.best ? (
                  <div className="flex items-center gap-2">
                    <TokenIconSimple symbol={totals.best.symbol} size={20} />
                    <span className="font-semibold text-sm">{totals.best.symbol}</span>
                    <span className="text-green-500 font-mono text-sm font-bold">
                      {formatPercent(totals.best.pnlPct)}
                    </span>
                  </div>
                ) : (
                  <span className="text-neutral-600 text-sm">--</span>
                )}
              </div>

              {/* Worst Performer */}
              <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-4">
                <p className="text-neutral-500 text-xs mb-1">Worst Performer</p>
                {totals.worst ? (
                  <div className="flex items-center gap-2">
                    <TokenIconSimple symbol={totals.worst.symbol} size={20} />
                    <span className="font-semibold text-sm">{totals.worst.symbol}</span>
                    <span className="text-red-500 font-mono text-sm font-bold">
                      {formatPercent(totals.worst.pnlPct)}
                    </span>
                  </div>
                ) : (
                  <span className="text-neutral-600 text-sm">--</span>
                )}
              </div>
            </div>

            {/* Pie chart + table */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
              {/* Pie chart */}
              <div className="lg:col-span-1 bg-hub-darker border border-white/[0.06] rounded-xl p-4">
                <h3 className="text-sm font-semibold mb-3 text-neutral-300">Allocation</h3>
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={90}
                        paddingAngle={2}
                        dataKey="value"
                        stroke="none"
                      >
                        {pieData.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        content={({ payload }) => {
                          if (!payload?.length) return null;
                          const d = payload[0].payload;
                          return (
                            <div className="bg-hub-darker border border-white/[0.08] rounded-lg px-3 py-2 text-xs shadow-xl">
                              <span className="font-semibold">{d.name}</span>
                              <span className="text-neutral-400 ml-2 font-mono">
                                {d.pct.toFixed(1)}%
                              </span>
                            </div>
                          );
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-60 flex items-center justify-center text-neutral-600 text-sm">
                    No data
                  </div>
                )}
                {/* Legend */}
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                  {pieData.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-1.5 text-xs">
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                      />
                      <span className="text-neutral-400">{d.name}</span>
                      <span className="text-neutral-600 font-mono">{d.pct.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Holdings table */}
              <div className="lg:col-span-3 bg-hub-darker border border-white/[0.06] rounded-xl overflow-hidden">
                {/* Sort controls */}
                <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06]">
                  <span className="text-neutral-500 text-xs">Sort by:</span>
                  {(['value', 'pnl', 'allocation'] as SortKey[]).map((key) => (
                    <button
                      key={key}
                      onClick={() => toggleSort(key)}
                      className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                        sortKey === key
                          ? 'bg-hub-yellow/15 text-hub-yellow'
                          : 'text-neutral-500 hover:text-white hover:bg-white/[0.04]'
                      }`}
                    >
                      {key === 'pnl' ? 'P&L' : key.charAt(0).toUpperCase() + key.slice(1)}
                      {sortKey === key && (
                        <span className="ml-1">{sortDir === 'desc' ? '\u2193' : '\u2191'}</span>
                      )}
                    </button>
                  ))}
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/[0.06]">
                        <th className="text-left px-4 py-2.5 text-neutral-500 text-xs font-medium">Symbol</th>
                        <th className="text-right px-4 py-2.5 text-neutral-500 text-xs font-medium">Quantity</th>
                        <th className="text-right px-4 py-2.5 text-neutral-500 text-xs font-medium">Avg Price</th>
                        <th className="text-right px-4 py-2.5 text-neutral-500 text-xs font-medium">Current</th>
                        <th className="text-right px-4 py-2.5 text-neutral-500 text-xs font-medium">P&amp;L ($)</th>
                        <th className="text-right px-4 py-2.5 text-neutral-500 text-xs font-medium">P&amp;L (%)</th>
                        <th className="text-right px-4 py-2.5 text-neutral-500 text-xs font-medium">Alloc %</th>
                        <th className="text-right px-4 py-2.5 text-neutral-500 text-xs font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.map((h) => {
                        const alloc = totals.totalValue > 0
                          ? (h.value / totals.totalValue) * 100
                          : 0;
                        return (
                          <tr
                            key={h.symbol}
                            className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2.5">
                                <TokenIconSimple symbol={h.symbol} size={24} />
                                <span className="font-semibold">{h.symbol}</span>
                              </div>
                            </td>
                            <td className="text-right px-4 py-3 font-mono text-neutral-300">
                              {formatQty(h.quantity)}
                            </td>
                            <td className="text-right px-4 py-3 font-mono text-neutral-300">
                              {formatPrice(h.avgPrice)}
                            </td>
                            <td className="text-right px-4 py-3 font-mono text-neutral-300">
                              {h.currentPrice > 0 ? formatPrice(h.currentPrice) : (
                                <span className="text-neutral-600">--</span>
                              )}
                            </td>
                            <td
                              className={`text-right px-4 py-3 font-mono font-semibold ${
                                h.pnl >= 0 ? 'text-green-500' : 'text-red-500'
                              }`}
                            >
                              {h.currentPrice > 0 ? (
                                <>
                                  {h.pnl >= 0 ? '+' : ''}{formatUSD(h.pnl)}
                                </>
                              ) : (
                                <span className="text-neutral-600">--</span>
                              )}
                            </td>
                            <td
                              className={`text-right px-4 py-3 font-mono font-semibold ${
                                h.pnlPct >= 0 ? 'text-green-500' : 'text-red-500'
                              }`}
                            >
                              {h.currentPrice > 0 ? formatPercent(h.pnlPct) : (
                                <span className="text-neutral-600">--</span>
                              )}
                            </td>
                            <td className="text-right px-4 py-3 font-mono text-neutral-400">
                              {alloc.toFixed(1)}%
                            </td>
                            <td className="text-right px-4 py-3">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => openEditModal(h)}
                                  className="p-1.5 rounded-md text-neutral-500 hover:text-hub-yellow hover:bg-white/[0.04] transition-colors"
                                  title="Edit position"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleRemove(h.symbol)}
                                  className="p-1.5 rounded-md text-neutral-500 hover:text-red-500 hover:bg-white/[0.04] transition-colors"
                                  title="Remove position"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Loading skeleton */}
        {isLoading && holdings.length > 0 && (
          <div className="bg-hub-darker border border-white/[0.06] rounded-xl overflow-hidden">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-white/[0.04] animate-pulse">
                <div className="w-16 h-4 bg-white/[0.06] rounded" />
                <div className="w-16 h-4 bg-white/[0.06] rounded" />
                <div className="w-20 h-4 bg-white/[0.06] rounded" />
                <div className="w-20 h-4 bg-white/[0.06] rounded" />
                <div className="w-16 h-4 bg-white/[0.06] rounded" />
                <div className="w-14 h-4 bg-white/[0.06] rounded" />
                <div className="w-14 h-4 bg-white/[0.06] rounded" />
                <div className="w-8 h-4 bg-white/[0.06] rounded" />
              </div>
            ))}
          </div>
        )}
        <div className="mt-4 p-3 rounded-lg bg-hub-yellow/5 border border-hub-yellow/10">
          <p className="text-neutral-500 text-xs leading-relaxed">
            Portfolio values use real-time prices from the highest-volume exchange. P&amp;L is calculated as unrealized gain/loss based on your average entry price. Allocation percentages are based on current market value. All holdings data is stored locally in your browser and never sent to any server. Prices refresh every 30 seconds.
          </p>
        </div>
      </main>

      <Footer />

      {/* Modal overlay */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-hub-darker border border-white/[0.08] rounded-xl w-full max-w-md shadow-2xl animate-scale-in">
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
              <h2 className="text-lg font-semibold">
                {editSymbol ? 'Edit Position' : 'Add Position'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-md text-neutral-500 hover:text-white hover:bg-white/[0.06] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal body */}
            <div className="px-5 py-4 space-y-4">
              {/* Symbol */}
              <div>
                <label className="block text-xs text-neutral-500 mb-1.5">Symbol</label>
                <input
                  type="text"
                  value={formSymbol}
                  onChange={(e) => setFormSymbol(e.target.value.toUpperCase())}
                  disabled={!!editSymbol}
                  placeholder="BTC"
                  className={`w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm font-mono placeholder-neutral-600 outline-none focus:border-hub-yellow/50 transition-colors ${
                    editSymbol ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                />
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-xs text-neutral-500 mb-1.5">Quantity</label>
                <input
                  type="number"
                  value={formQty}
                  onChange={(e) => setFormQty(e.target.value)}
                  placeholder="0.5"
                  step="any"
                  min="0"
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm font-mono placeholder-neutral-600 outline-none focus:border-hub-yellow/50 transition-colors"
                />
              </div>

              {/* Average Price */}
              <div>
                <label className="block text-xs text-neutral-500 mb-1.5">Average Price (USD)</label>
                <input
                  type="number"
                  value={formPrice}
                  onChange={(e) => setFormPrice(e.target.value)}
                  placeholder="42000"
                  step="any"
                  min="0"
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm font-mono placeholder-neutral-600 outline-none focus:border-hub-yellow/50 transition-colors"
                />
              </div>
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-white/[0.06]">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-lg text-sm text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={
                  !formSymbol.trim() ||
                  !formQty ||
                  parseFloat(formQty) <= 0 ||
                  !formPrice ||
                  parseFloat(formPrice) <= 0
                }
                className="px-5 py-2 rounded-lg bg-hub-yellow text-black font-semibold text-sm hover:brightness-110 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {editSymbol ? 'Save Changes' : 'Add Position'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
