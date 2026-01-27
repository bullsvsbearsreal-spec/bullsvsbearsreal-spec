'use client';

import { liquidationData } from '@/lib/mockData';
import { Zap, TrendingUp, ArrowUpRight, ArrowDownRight } from 'lucide-react';

function formatNumber(num: number): string {
  if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
  return `$${num.toLocaleString()}`;
}

export default function LiquidationsCard() {
  const totalLiquidations = liquidationData.reduce((sum, liq) => sum + liq.totalLiquidations, 0);
  const totalLongs = liquidationData.reduce((sum, liq) => sum + liq.longLiquidations, 0);
  const totalShorts = liquidationData.reduce((sum, liq) => sum + liq.shortLiquidations, 0);

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-hub-gray/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-danger/20 to-hub-orange/10 rounded-xl">
              <Zap className="w-5 h-5 text-danger" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">24h Liquidations</h2>
              <p className="text-hub-gray-text text-xs">Rekt traders across all exchanges</p>
            </div>
          </div>
          <div className="flex items-center gap-1 px-2 py-1 bg-danger/10 rounded-lg">
            <ArrowUpRight className="w-3.5 h-3.5 text-danger" />
            <span className="text-sm font-semibold text-danger">+355.85%</span>
          </div>
        </div>

        {/* Total summary */}
        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="bg-hub-gray/20 rounded-xl p-3 text-center">
            <p className="text-xs text-hub-gray-text mb-1">Total</p>
            <p className="text-lg font-bold text-white">{formatNumber(totalLiquidations)}</p>
          </div>
          <div className="bg-success/5 rounded-xl p-3 text-center border border-success/20">
            <p className="text-xs text-success/70 mb-1">Longs</p>
            <p className="text-lg font-bold text-success">{formatNumber(totalLongs)}</p>
          </div>
          <div className="bg-danger/5 rounded-xl p-3 text-center border border-danger/20">
            <p className="text-xs text-danger/70 mb-1">Shorts</p>
            <p className="text-lg font-bold text-danger">{formatNumber(totalShorts)}</p>
          </div>
        </div>
      </div>

      {/* Liquidations by symbol */}
      <div className="p-5 space-y-4">
        {liquidationData.map((liq, index) => {
          const longPercent = (liq.longLiquidations / liq.totalLiquidations) * 100;
          const shortPercent = (liq.shortLiquidations / liq.totalLiquidations) * 100;

          return (
            <div key={index} className="group">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-hub-yellow/20 to-hub-orange/10 flex items-center justify-center">
                    <span className="text-xs font-bold text-hub-yellow">{liq.symbol.slice(0, 2)}</span>
                  </div>
                  <span className="font-semibold text-white group-hover:text-hub-yellow transition-colors">{liq.symbol}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-hub-gray-text-light text-sm font-medium">{formatNumber(liq.totalLiquidations)}</span>
                  <span className="text-xs text-hub-yellow">+{liq.change24h.toFixed(0)}%</span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="relative h-3 rounded-full overflow-hidden bg-hub-gray/30">
                <div
                  className="absolute left-0 top-0 h-full bg-gradient-to-r from-success to-success/70 transition-all duration-500"
                  style={{ width: `${longPercent}%` }}
                />
                <div
                  className="absolute right-0 top-0 h-full bg-gradient-to-l from-danger to-danger/70 transition-all duration-500"
                  style={{ width: `${shortPercent}%` }}
                />
                {/* Center divider */}
                <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-hub-dark transform -translate-x-1/2" />
              </div>

              {/* Labels */}
              <div className="flex justify-between mt-1.5 text-xs">
                <div className="flex items-center gap-1">
                  <ArrowUpRight className="w-3 h-3 text-success" />
                  <span className="text-success">{formatNumber(liq.longLiquidations)}</span>
                  <span className="text-hub-gray-text">({longPercent.toFixed(1)}%)</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-hub-gray-text">({shortPercent.toFixed(1)}%)</span>
                  <span className="text-danger">{formatNumber(liq.shortLiquidations)}</span>
                  <ArrowDownRight className="w-3 h-3 text-danger" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}