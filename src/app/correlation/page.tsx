'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useApiData } from '@/hooks/useApiData';
import { RefreshCw, AlertTriangle, Info } from 'lucide-react';
import { savePriceSnapshot } from '@/lib/storage/priceHistory';

// ─── Types ──────────────────────────────────────────────────────────────────

interface SymbolEntry {
  symbol: string;
  changes: { exchange: string; change24h: number }[];
  avgChange: number;
  avgPrice: number;
  totalVolume: number;
  exchangeCount: number;
}

interface CorrelationData {
  symbols: SymbolEntry[];
  totalExchanges: number;
  timestamp: number;
}

type CountFilter = 10 | 15 | 20;

// ─── Pearson Correlation ────────────────────────────────────────────────────

/**
 * Compute Pearson correlation coefficient between two arrays.
 * Returns NaN if insufficient data or zero variance.
 */
function pearsonCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 3) return NaN;

  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;

  for (let i = 0; i < n; i++) {
    sumX += x[i];
    sumY += y[i];
    sumXY += x[i] * y[i];
    sumX2 += x[i] * x[i];
    sumY2 += y[i] * y[i];
  }

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt(
    (n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY)
  );

  if (denominator === 0) return NaN;
  return numerator / denominator;
}

/**
 * Build aligned change arrays for two symbols across their common exchanges.
 */
function getAlignedChanges(
  a: SymbolEntry,
  b: SymbolEntry
): { x: number[]; y: number[] } {
  const bMap = new Map(b.changes.map(c => [c.exchange, c.change24h]));
  const x: number[] = [];
  const y: number[] = [];

  for (const ac of a.changes) {
    const bChange = bMap.get(ac.exchange);
    if (bChange !== undefined) {
      x.push(ac.change24h);
      y.push(bChange);
    }
  }

  return { x, y };
}

// ─── Color helpers ──────────────────────────────────────────────────────────

function getCorrelationColor(r: number): string {
  if (isNaN(r)) return 'bg-neutral-800/50';

  // Strong positive: warm reds/oranges
  if (r >= 0.9) return 'bg-orange-500/90';
  if (r >= 0.7) return 'bg-orange-500/70';
  if (r >= 0.5) return 'bg-orange-500/50';
  if (r >= 0.3) return 'bg-orange-500/30';
  if (r >= 0.1) return 'bg-amber-600/20';
  // Near zero: neutral
  if (r >= -0.1) return 'bg-neutral-700/40';
  // Negative: cool blues
  if (r >= -0.3) return 'bg-blue-600/20';
  if (r >= -0.5) return 'bg-blue-500/30';
  if (r >= -0.7) return 'bg-blue-500/50';
  if (r >= -0.9) return 'bg-blue-500/70';
  return 'bg-blue-500/90';
}

function getCorrelationTextColor(r: number): string {
  if (isNaN(r)) return 'text-neutral-600';
  if (r >= 0.7) return 'text-orange-300';
  if (r >= 0.3) return 'text-orange-400/80';
  if (r >= -0.3) return 'text-neutral-400';
  if (r >= -0.7) return 'text-blue-400/80';
  return 'text-blue-300';
}

function getCorrelationLabel(r: number): string {
  if (isNaN(r)) return 'Insufficient data';
  const abs = Math.abs(r);
  const direction = r >= 0 ? 'positive' : 'negative';
  if (abs >= 0.9) return `Very strong ${direction}`;
  if (abs >= 0.7) return `Strong ${direction}`;
  if (abs >= 0.5) return `Moderate ${direction}`;
  if (abs >= 0.3) return `Weak ${direction}`;
  return 'No significant correlation';
}

// ─── Volume formatter ───────────────────────────────────────────────────────

function formatVolume(v: number): string {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v}`;
}

// ─── Page Component ─────────────────────────────────────────────────────────

export default function CorrelationPage() {
  const [count, setCount] = useState<CountFilter>(15);
  const [hoveredCell, setHoveredCell] = useState<{
    row: number;
    col: number;
    rowSym: string;
    colSym: string;
    r: number;
  } | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // Fetch correlation data
  const { data, error, isLoading, lastUpdate, refresh, isRefreshing } =
    useApiData<CorrelationData>({
      fetcher: useCallback(async () => {
        const res = await fetch('/api/correlation?count=25');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      }, []),
      refreshInterval: 60000,
    });

  // Save price snapshots to localStorage for future richer analysis
  useEffect(() => {
    if (!data?.symbols) return;
    const prices: Record<string, number> = {};
    data.symbols.forEach(s => {
      if (s.avgPrice > 0) prices[s.symbol] = s.avgPrice;
    });
    if (Object.keys(prices).length > 0) {
      savePriceSnapshot(prices);
    }
  }, [data]);

  // Slice symbols to selected count
  const symbols = useMemo(() => {
    if (!data?.symbols) return [];
    return data.symbols.slice(0, count);
  }, [data, count]);

  // Compute correlation matrix
  const matrix = useMemo(() => {
    if (symbols.length === 0) return [];

    const n = symbols.length;
    const result: number[][] = Array.from({ length: n }, () =>
      new Array(n).fill(0)
    );

    for (let i = 0; i < n; i++) {
      result[i][i] = 1.0; // Self-correlation
      for (let j = i + 1; j < n; j++) {
        const { x, y } = getAlignedChanges(symbols[i], symbols[j]);
        const r = pearsonCorrelation(x, y);
        result[i][j] = r;
        result[j][i] = r; // Symmetric
      }
    }

    return result;
  }, [symbols]);

  // Statistics
  const stats = useMemo(() => {
    if (matrix.length === 0 || symbols.length < 2) {
      return {
        avgCorrelation: 0,
        mostCorrelated: { pair: '-', r: 0 },
        leastCorrelated: { pair: '-', r: 0 },
        validPairs: 0,
      };
    }

    let sum = 0;
    let validCount = 0;
    let maxR = -Infinity;
    let minR = Infinity;
    let maxPair = '';
    let minPair = '';

    for (let i = 0; i < matrix.length; i++) {
      for (let j = i + 1; j < matrix.length; j++) {
        const r = matrix[i][j];
        if (isNaN(r)) continue;
        sum += r;
        validCount++;
        if (r > maxR) {
          maxR = r;
          maxPair = `${symbols[i].symbol} / ${symbols[j].symbol}`;
        }
        if (r < minR) {
          minR = r;
          minPair = `${symbols[i].symbol} / ${symbols[j].symbol}`;
        }
      }
    }

    return {
      avgCorrelation: validCount > 0 ? sum / validCount : 0,
      mostCorrelated: { pair: maxPair || '-', r: isFinite(maxR) ? maxR : 0 },
      leastCorrelated: { pair: minPair || '-', r: isFinite(minR) ? minR : 0 },
      validPairs: validCount,
    };
  }, [matrix, symbols]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    setTooltipPos({ x: e.clientX, y: e.clientY });
  }, []);

  return (
    <div className="min-h-screen bg-hub-black text-white">
      <Header />
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h1 className="text-lg font-bold text-white">Correlation Matrix</h1>
            <p className="text-xs text-neutral-500 mt-0.5">
              Cross-exchange 24h price change correlation between top {count} symbols
            </p>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdate && (
              <span className="text-[11px] text-neutral-600">
                Updated {lastUpdate.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={refresh}
              disabled={isRefreshing}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-3">
            <div className="text-[11px] text-neutral-500 mb-1">Avg Correlation</div>
            <div className={`text-lg font-bold font-mono ${stats.avgCorrelation >= 0.5 ? 'text-orange-400' : stats.avgCorrelation >= 0 ? 'text-neutral-300' : 'text-blue-400'}`}>
              {stats.avgCorrelation.toFixed(3)}
            </div>
          </div>
          <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-3">
            <div className="text-[11px] text-neutral-500 mb-1">Most Correlated</div>
            <div className="text-sm font-bold text-orange-400 truncate">{stats.mostCorrelated.pair}</div>
            <div className="text-xs text-neutral-500 font-mono">r = {stats.mostCorrelated.r.toFixed(3)}</div>
          </div>
          <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-3">
            <div className="text-[11px] text-neutral-500 mb-1">Least Correlated</div>
            <div className="text-sm font-bold text-blue-400 truncate">{stats.leastCorrelated.pair}</div>
            <div className="text-xs text-neutral-500 font-mono">r = {stats.leastCorrelated.r.toFixed(3)}</div>
          </div>
          <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-3">
            <div className="text-[11px] text-neutral-500 mb-1">Valid Pairs</div>
            <div className="text-lg font-bold text-white">{stats.validPairs}</div>
            <div className="text-xs text-neutral-500">
              {data?.totalExchanges ?? 0} exchanges
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex rounded-lg overflow-hidden bg-white/[0.04] border border-white/[0.06]">
            {([10, 15, 20] as CountFilter[]).map(n => (
              <button
                key={n}
                onClick={() => setCount(n)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  count === n
                    ? 'bg-hub-yellow text-black'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Top {n}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-neutral-600">
            <Info className="w-3 h-3" />
            Pearson r from cross-exchange 24h changes
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 p-3 mb-4 bg-red-500/10 border border-red-500/20 rounded-xl">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span className="text-sm text-red-400">{error}</span>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="space-y-4">
            {/* Stats skeleton */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-hub-darker border border-white/[0.06] rounded-xl p-4 animate-pulse">
                  <div className="h-3 w-20 bg-white/[0.06] rounded mb-3" />
                  <div className="h-7 w-28 bg-white/[0.06] rounded" />
                </div>
              ))}
            </div>
            {/* Matrix skeleton */}
            <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-6 animate-pulse">
              <div className="grid grid-cols-6 gap-1">
                {Array.from({ length: 36 }).map((_, i) => (
                  <div key={i} className="aspect-square bg-white/[0.04] rounded-[3px]" />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !error && symbols.length === 0 && data && (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="text-neutral-500 text-sm mb-2">No correlation data available</div>
            <div className="text-neutral-600 text-xs">Market data may be temporarily unavailable</div>
          </div>
        )}

        {/* Correlation Matrix */}
        {!isLoading && matrix.length > 0 && (
          <div className="relative">
          <div
            className="bg-hub-darker border border-white/[0.06] rounded-xl p-3 sm:p-4 overflow-x-auto"
            onMouseMove={handleMouseMove}
          >
            <div
              className="grid gap-[1px] min-w-fit"
              style={{
                gridTemplateColumns: `48px repeat(${symbols.length}, minmax(44px, 1fr))`,
                gridTemplateRows: `32px repeat(${symbols.length}, minmax(36px, 1fr))`,
              }}
            >
              {/* Top-left empty corner */}
              <div />

              {/* Column headers */}
              {symbols.map((s, colIdx) => (
                <div
                  key={`col-${s.symbol}`}
                  className="flex items-end justify-center pb-1"
                >
                  <span
                    className={`text-[10px] sm:text-[11px] font-bold transition-colors ${
                      hoveredCell && (hoveredCell.col === colIdx || hoveredCell.row === colIdx)
                        ? 'text-white'
                        : 'text-neutral-500'
                    }`}
                    style={{
                      writingMode: symbols.length > 12 ? 'vertical-rl' : undefined,
                      textOrientation: symbols.length > 12 ? 'mixed' : undefined,
                    }}
                  >
                    {s.symbol}
                  </span>
                </div>
              ))}

              {/* Matrix rows */}
              {symbols.map((rowSym, rowIdx) => (
                <>
                  {/* Row header */}
                  <div
                    key={`row-${rowSym.symbol}`}
                    className="flex items-center justify-end pr-2"
                  >
                    <span
                      className={`text-[10px] sm:text-[11px] font-bold transition-colors ${
                        hoveredCell && (hoveredCell.row === rowIdx || hoveredCell.col === rowIdx)
                          ? 'text-white'
                          : 'text-neutral-500'
                      }`}
                    >
                      {rowSym.symbol}
                    </span>
                  </div>

                  {/* Row cells */}
                  {symbols.map((colSym, colIdx) => {
                    const r = matrix[rowIdx][colIdx];
                    const isDiagonal = rowIdx === colIdx;
                    const isHovered =
                      hoveredCell?.row === rowIdx && hoveredCell?.col === colIdx;

                    return (
                      <div
                        key={`cell-${rowIdx}-${colIdx}`}
                        className={`
                          relative flex items-center justify-center rounded-[3px] cursor-default
                          transition-all duration-100
                          ${isDiagonal ? 'bg-white/[0.08]' : getCorrelationColor(r)}
                          ${isHovered ? 'ring-1 ring-white/40 z-10 scale-105' : ''}
                          ${hoveredCell && !isHovered && (hoveredCell.row === rowIdx || hoveredCell.col === colIdx) ? 'brightness-110' : ''}
                        `}
                        onMouseEnter={() =>
                          setHoveredCell({
                            row: rowIdx,
                            col: colIdx,
                            rowSym: rowSym.symbol,
                            colSym: colSym.symbol,
                            r,
                          })
                        }
                        onMouseLeave={() => setHoveredCell(null)}
                      >
                        <span
                          className={`text-[10px] sm:text-xs font-mono font-medium ${
                            isDiagonal
                              ? 'text-neutral-500'
                              : getCorrelationTextColor(r)
                          }`}
                        >
                          {isNaN(r) ? '-' : r.toFixed(2)}
                        </span>
                      </div>
                    );
                  })}
                </>
              ))}
            </div>

            {/* Tooltip */}
            {hoveredCell && (
              <div
                className="fixed z-50 pointer-events-none bg-hub-gray border border-white/[0.1] rounded-lg p-3 shadow-xl"
                style={{
                  left: tooltipPos.x + 260 > window.innerWidth ? tooltipPos.x - 260 : tooltipPos.x + 14,
                  top: tooltipPos.y + 200 > window.innerHeight ? tooltipPos.y - 200 : tooltipPos.y + 14,
                }}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="font-bold text-white text-sm">
                    {hoveredCell.rowSym} &times; {hoveredCell.colSym}
                  </span>
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between gap-4">
                    <span className="text-neutral-500">Correlation (r)</span>
                    <span className={`font-mono font-bold ${getCorrelationTextColor(hoveredCell.r)}`}>
                      {isNaN(hoveredCell.r) ? 'N/A' : hoveredCell.r.toFixed(4)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-neutral-500">Interpretation</span>
                    <span className="text-neutral-300">
                      {getCorrelationLabel(hoveredCell.r)}
                    </span>
                  </div>
                  {!isNaN(hoveredCell.r) && (
                    <div className="flex justify-between gap-4">
                      <span className="text-neutral-500">R-squared</span>
                      <span className="text-neutral-300 font-mono">
                        {(hoveredCell.r * hoveredCell.r).toFixed(4)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between gap-4">
                    <span className="text-neutral-500">Common exchanges</span>
                    <span className="text-neutral-300 font-mono">
                      {(() => {
                        const a = symbols.find(s => s.symbol === hoveredCell.rowSym);
                        const b = symbols.find(s => s.symbol === hoveredCell.colSym);
                        if (!a || !b) return '-';
                        const bSet = new Set(b.changes.map(c => c.exchange));
                        return a.changes.filter(c => bSet.has(c.exchange)).length;
                      })()}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[#0d0d0d] to-transparent md:hidden" />
          </div>
        )}

        {/* Legend */}
        {!isLoading && matrix.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-1 mt-3">
            <span className="text-[10px] text-neutral-500 mr-1">-1.0</span>
            <div className="w-5 h-3 rounded-sm bg-blue-500/90" />
            <div className="w-5 h-3 rounded-sm bg-blue-500/70" />
            <div className="w-5 h-3 rounded-sm bg-blue-500/50" />
            <div className="w-5 h-3 rounded-sm bg-blue-500/30" />
            <div className="w-5 h-3 rounded-sm bg-blue-600/20" />
            <div className="w-5 h-3 rounded-sm bg-neutral-700/40" />
            <div className="w-5 h-3 rounded-sm bg-amber-600/20" />
            <div className="w-5 h-3 rounded-sm bg-orange-500/30" />
            <div className="w-5 h-3 rounded-sm bg-orange-500/50" />
            <div className="w-5 h-3 rounded-sm bg-orange-500/70" />
            <div className="w-5 h-3 rounded-sm bg-orange-500/90" />
            <span className="text-[10px] text-neutral-500 ml-1">+1.0</span>
          </div>
        )}

        {/* Symbol details table */}
        {!isLoading && symbols.length > 0 && (
          <div className="mt-6 bg-hub-darker border border-white/[0.06] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/[0.06]">
              <h2 className="text-sm font-semibold text-white">Symbol Details</h2>
              <p className="text-[11px] text-neutral-500 mt-0.5">
                24h change per exchange for each symbol
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="text-left text-neutral-500 font-medium px-4 py-2">Symbol</th>
                    <th className="text-right text-neutral-500 font-medium px-4 py-2">Avg Change</th>
                    <th className="text-right text-neutral-500 font-medium px-4 py-2">Volume 24h</th>
                    <th className="text-right text-neutral-500 font-medium px-4 py-2">Exchanges</th>
                    <th className="text-left text-neutral-500 font-medium px-4 py-2">Exchange Changes</th>
                  </tr>
                </thead>
                <tbody>
                  {symbols.map(s => (
                    <tr
                      key={s.symbol}
                      className="border-b border-white/[0.03] hover:bg-white/[0.02]"
                    >
                      <td className="px-4 py-2 font-bold text-white">{s.symbol}</td>
                      <td className={`px-4 py-2 text-right font-mono ${s.avgChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {s.avgChange >= 0 ? '+' : ''}{s.avgChange.toFixed(2)}%
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-neutral-300">
                        {formatVolume(s.totalVolume)}
                      </td>
                      <td className="px-4 py-2 text-right text-neutral-400">{s.exchangeCount}</td>
                      <td className="px-4 py-2">
                        <div className="flex flex-wrap gap-1.5">
                          {s.changes
                            .sort((a, b) => Math.abs(b.change24h) - Math.abs(a.change24h))
                            .slice(0, 6)
                            .map(c => (
                              <span
                                key={c.exchange}
                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] ${
                                  c.change24h >= 0
                                    ? 'bg-green-500/10 text-green-400'
                                    : 'bg-red-500/10 text-red-400'
                                }`}
                              >
                                <span className="text-neutral-500">{c.exchange.slice(0, 3)}</span>
                                {c.change24h >= 0 ? '+' : ''}{c.change24h.toFixed(2)}%
                              </span>
                            ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Methodology note */}
        {!isLoading && matrix.length > 0 && (
          <div className="mt-4 p-3 rounded-lg bg-hub-yellow/5 border border-hub-yellow/10">
            <p className="text-neutral-500 text-xs leading-relaxed">
              <strong className="text-neutral-400">Methodology:</strong> Correlation is computed
              using the Pearson coefficient on 24h price change percentages across common
              exchanges. Each symbol pair uses only exchanges where both assets are listed.
              Minimum 3 common exchanges required. Values range from -1 (perfect inverse)
              to +1 (perfect correlation). Price snapshots are stored locally for future
              time-series analysis.
            </p>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
