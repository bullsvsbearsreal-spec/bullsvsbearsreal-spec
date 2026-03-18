'use client';

import { useMemo, useState } from 'react';
import { Info } from 'lucide-react';

interface CorrelationMatrixProps {
  fundingRates: Array<{
    symbol: string;
    exchange: string;
    rate: number;
  }>;
}

const TOP_SYMBOLS = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'AVAX', 'LINK', 'ADA', 'DOT', 'SUI'];
const MIN_SHARED_EXCHANGES = 3;

function pearsonCorrelation(x: number[], y: number[]): number | null {
  const n = x.length;
  if (n < MIN_SHARED_EXCHANGES) return null;

  let sumX = 0, sumY = 0;
  for (let i = 0; i < n; i++) {
    sumX += x[i];
    sumY += y[i];
  }
  const meanX = sumX / n;
  const meanY = sumY / n;

  let num = 0, denomX = 0, denomY = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    num += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }

  const denom = Math.sqrt(denomX * denomY);
  if (denom === 0) return null;
  return num / denom;
}

function getCellColor(r: number): string {
  const abs = Math.min(Math.abs(r), 1);
  if (r > 0) {
    // Green scale: intensity proportional to value
    const alpha = 0.08 + abs * 0.52; // range 0.08 to 0.60
    return `rgba(34, 197, 94, ${alpha.toFixed(2)})`;
  } else {
    // Red scale
    const alpha = 0.08 + abs * 0.52;
    return `rgba(239, 68, 68, ${alpha.toFixed(2)})`;
  }
}

function getCellTextColor(r: number): string {
  const abs = Math.abs(r);
  if (abs > 0.6) return 'rgba(255, 255, 255, 0.95)';
  if (abs > 0.3) return 'rgba(255, 255, 255, 0.75)';
  return 'rgba(255, 255, 255, 0.5)';
}

export default function CorrelationMatrix({ fundingRates }: CorrelationMatrixProps) {
  const [showInfo, setShowInfo] = useState(false);

  // Build map: symbol -> Map<exchange, rate>
  const symbolExchangeRates = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    for (const fr of fundingRates) {
      if (!TOP_SYMBOLS.includes(fr.symbol)) continue;
      if (!map.has(fr.symbol)) map.set(fr.symbol, new Map());
      map.get(fr.symbol)!.set(fr.exchange, fr.rate);
    }
    return map;
  }, [fundingRates]);

  // Only show symbols that actually have data
  const activeSymbols = useMemo(
    () => TOP_SYMBOLS.filter(s => symbolExchangeRates.has(s)),
    [symbolExchangeRates]
  );

  // Compute correlation matrix
  const matrix = useMemo(() => {
    const n = activeSymbols.length;
    const result: (number | null)[][] = Array.from({ length: n }, () => Array(n).fill(null));

    for (let i = 0; i < n; i++) {
      result[i][i] = 1.0; // self-correlation
      const ratesA = symbolExchangeRates.get(activeSymbols[i]);
      if (!ratesA) continue;

      for (let j = i + 1; j < n; j++) {
        const ratesB = symbolExchangeRates.get(activeSymbols[j]);
        if (!ratesB) continue;

        // Find shared exchanges
        const xVals: number[] = [];
        const yVals: number[] = [];
        ratesA.forEach((rateA, exchange) => {
          const rateB = ratesB.get(exchange);
          if (rateB !== undefined) {
            xVals.push(rateA);
            yVals.push(rateB);
          }
        });

        const r = pearsonCorrelation(xVals, yVals);
        result[i][j] = r;
        result[j][i] = r; // symmetric
      }
    }

    return result;
  }, [activeSymbols, symbolExchangeRates]);

  if (activeSymbols.length < 2) return null;

  return (
    <div className="mb-5 bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 sm:p-5">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-sm font-semibold text-white">Funding Rate Correlation</h3>
        <div className="relative">
          <button
            onClick={() => setShowInfo(!showInfo)}
            className="text-neutral-600 hover:text-neutral-400 transition-colors"
            aria-label="Info"
          >
            <Info className="w-3.5 h-3.5" />
          </button>
          {showInfo && (
            <div className="absolute left-0 top-full mt-1.5 z-30 w-64 p-3 rounded-lg bg-[#1a1a1a] border border-white/[0.08] shadow-xl text-[11px] text-neutral-400 leading-relaxed">
              Pearson correlation of funding rates across shared exchanges.
              Values near <span className="text-emerald-400">+1</span> mean rates move together;
              near <span className="text-red-400">-1</span> means they move oppositely.
              Requires at least {MIN_SHARED_EXCHANGES} shared exchanges.
            </div>
          )}
        </div>
      </div>

      {/* Matrix */}
      <div className="overflow-x-auto -mx-1">
        <div className="inline-block min-w-0">
          {/* Header row */}
          <div className="flex">
            {/* Empty top-left corner */}
            <div className="w-11 h-7 flex-shrink-0" />
            {activeSymbols.map(sym => (
              <div
                key={`h-${sym}`}
                className="w-[46px] h-7 flex-shrink-0 flex items-center justify-center text-[10px] font-semibold text-neutral-500"
              >
                {sym}
              </div>
            ))}
          </div>

          {/* Data rows */}
          {activeSymbols.map((rowSym, i) => (
            <div key={rowSym} className="flex">
              {/* Row label */}
              <div className="w-11 h-[46px] flex-shrink-0 flex items-center justify-end pr-2 text-[10px] font-semibold text-neutral-500">
                {rowSym}
              </div>
              {/* Cells */}
              {activeSymbols.map((colSym, j) => {
                const val = matrix[i][j];
                const isDiag = i === j;
                return (
                  <div
                    key={`${rowSym}-${colSym}`}
                    className="w-[46px] h-[46px] flex-shrink-0 flex items-center justify-center border border-white/[0.03] transition-colors"
                    style={{
                      backgroundColor: val !== null
                        ? isDiag
                          ? 'rgba(255, 255, 255, 0.04)'
                          : getCellColor(val)
                        : 'transparent',
                    }}
                    title={val !== null ? `${rowSym}/${colSym}: ${val.toFixed(3)}` : `${rowSym}/${colSym}: insufficient data`}
                  >
                    <span
                      className="text-[10px] font-mono font-medium"
                      style={{
                        color: val !== null
                          ? isDiag
                            ? 'rgba(255, 255, 255, 0.25)'
                            : getCellTextColor(val)
                          : 'rgba(255, 255, 255, 0.15)',
                      }}
                    >
                      {val !== null ? (isDiag ? '1.00' : val.toFixed(2)) : '\u2014'}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mt-3 text-[10px] text-neutral-600">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'rgba(239, 68, 68, 0.45)' }} />
          <span>-1.0</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'rgba(255, 255, 255, 0.04)' }} />
          <span>0</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'rgba(34, 197, 94, 0.45)' }} />
          <span>+1.0</span>
        </div>
        <span className="text-neutral-700 ml-1">\u2014 = &lt;{MIN_SHARED_EXCHANGES} shared exchanges</span>
      </div>
    </div>
  );
}
