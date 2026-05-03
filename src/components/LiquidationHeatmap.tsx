'use client';

import { useMemo, useCallback } from 'react';
import { RefreshCw, Flame } from 'lucide-react';
import { formatLiqValue } from '@/lib/utils/format';
import { useMultiExchangeLiquidations, type Liquidation } from '@/hooks/useMultiExchangeLiquidations';
import { useSound } from '@/hooks/useSound';

const EXCHANGES = ['Binance', 'Bybit', 'OKX', 'Bitget', 'Deribit', 'HTX', 'gTrade'];

/** Trader slang based on total liq volume */
function getLiqSlang(totalValue: number, longPct: number): string | null {
  if (totalValue >= 100_000_000) return 'Absolute carnage across the board';
  if (totalValue >= 50_000_000) return 'Heavy liquidation cascade';
  if (totalValue >= 10_000_000) {
    if (longPct >= 70) return 'Longs getting wrecked';
    if (longPct <= 30) return 'Short squeeze in progress';
    return 'Both sides taking damage';
  }
  return null;
}

export default function LiquidationHeatmap() {
  const { playLiquidation } = useSound();

  const onLiquidation = useCallback((liq: Liquidation) => {
    // Sound on large liquidations (>$500K)
    if (liq.value >= 500_000) playLiquidation();
  }, [playLiquidation]);

  const { connections, stats, aggregated } = useMultiExchangeLiquidations({
    exchanges: EXCHANGES,
    minValue: 100,
    maxItems: 500,
    persistKey: 'ih-liq-home',
    persistTtlMs: 3600000, // 1h
    onLiquidation,
    // Hydrate from DB on mount so fresh visitors see real 24h totals, not just
    // whatever their browser saw since page open. WS events merge on top.
    hydrateFromApi: '/api/liquidations/aggregate?hours=24&limit=30',
  });

  const connectedCount = connections.filter(c => c.connected).length;
  const anyConnected = connectedCount > 0;

  const totalValue = stats.longValue + stats.shortValue;
  const longPct = totalValue > 0 ? (stats.longValue / totalValue) * 100 : 50;
  const isHeavyLiq = totalValue >= 10_000_000;
  const slang = getLiqSlang(totalValue, longPct);

  const sortedLiqs = useMemo(() => {
    return Array.from(aggregated.values())
      .sort((a, b) => b.totalValue - a.totalValue)
      .slice(0, 12);
  }, [aggregated]);

  const maxValue = Math.max(...sortedLiqs.map(l => l.totalValue), 1);

  return (
    <div className={`card-premium p-4 h-full ${isHeavyLiq ? 'card-bearish' : ''}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-hub-yellow/10 flex items-center justify-center">
            <Flame className="w-3 h-3 text-hub-yellow" />
          </div>
          <div>
            <h3 className="text-white font-semibold text-sm">Liquidation Heatmap</h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`h-1.5 w-1.5 rounded-full ${anyConnected ? 'bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.5)]' : 'bg-yellow-500 animate-pulse'}`} />
              <span className="text-neutral-600 text-[10px]">
                {anyConnected ? `${connectedCount}/${EXCHANGES.length} exchanges` : 'Connecting...'}
              </span>
            </div>
          </div>
        </div>

        {/* Exchange dots */}
        <div className="flex items-center gap-1">
          {connections.map(c => (
            <div
              key={c.exchange}
              className={`h-1.5 w-1.5 rounded-full ${c.connected ? 'bg-green-500' : 'bg-neutral-700'}`}
              title={`${c.exchange}: ${c.connected ? 'connected' : c.error || 'disconnected'}`}
            />
          ))}
        </div>
      </div>

      {/* Stats row — upgraded with intensity */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-white/[0.03] rounded-lg px-3 py-2 text-center border border-white/[0.04]">
          <div className="text-[10px] text-neutral-500 mb-0.5 font-medium">Total Rekt</div>
          <div className={`font-bold font-mono tabular-nums ${
            isHeavyLiq ? 'text-base text-rekt-hot' : 'text-sm text-white'
          }`} style={isHeavyLiq ? { textShadow: '0 0 6px rgba(255, 23, 68, 0.3)' } : undefined}>
            {formatLiqValue(totalValue)}
          </div>
        </div>
        <div className="bg-red-500/[0.04] rounded-lg px-3 py-2 text-center border border-red-500/10">
          <div className="text-[10px] text-neutral-500 mb-0.5 font-medium">Longs</div>
          <div className="text-sm font-bold text-red-400 font-mono tabular-nums">{formatLiqValue(stats.longValue)}</div>
        </div>
        <div className="bg-green-500/[0.04] rounded-lg px-3 py-2 text-center border border-green-500/10">
          <div className="text-[10px] text-neutral-500 mb-0.5 font-medium">Shorts</div>
          <div className="text-sm font-bold text-green-400 font-mono tabular-nums">{formatLiqValue(stats.shortValue)}</div>
        </div>
      </div>

      {/* Trader slang */}
      {slang && (
        <p className="text-[10px] mb-2 italic text-center" style={{ color: 'var(--highlight-hot)', opacity: 0.7 }}>{slang}</p>
      )}

      {/* Long/Short ratio bar */}
      {totalValue > 0 && (
        <div className="mb-3">
          <div className="flex h-1.5 rounded-full overflow-hidden bg-white/[0.04]">
            <div className="bg-gradient-to-r from-red-500 to-red-400 transition-all duration-500 rounded-l-full" style={{ width: `${longPct}%` }} />
            <div className="bg-gradient-to-r from-green-400 to-green-500 transition-all duration-500 rounded-r-full" style={{ width: `${100 - longPct}%` }} />
          </div>
          <div className="flex justify-between mt-1 text-[9px] font-mono">
            <span className="text-red-400 font-semibold">{longPct.toFixed(0)}% Long</span>
            <span className="text-green-400 font-semibold">{(100 - longPct).toFixed(0)}% Short</span>
          </div>
        </div>
      )}

      {sortedLiqs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-neutral-600">
          <RefreshCw className="w-4 h-4 animate-spin mb-2 opacity-50" />
          <p className="text-xs">Collecting liquidation data...</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 md:grid-cols-4 gap-1.5">
          {sortedLiqs.map((liq, index) => {
            const isLongDominant = liq.longValue > liq.shortValue;
            const intensity = Math.min((liq.totalValue / maxValue) * 100, 100);
            const sizeClass = index < 3 ? 'h-20' : index < 6 ? 'h-16' : 'h-14';
            const isWhale = liq.totalValue >= 1_000_000;

            return (
              <div
                key={liq.symbol}
                className={`${sizeClass} rounded-lg px-2.5 py-2 flex flex-col justify-between relative overflow-hidden transition-all duration-300 hover:scale-[1.03] cursor-pointer`}
                style={{
                  background: isLongDominant
                    ? `rgba(239, 68, 68, ${0.08 + (intensity / 100) * 0.25})`
                    : `rgba(34, 197, 94, ${0.08 + (intensity / 100) * 0.25})`,
                  border: `1px solid ${isLongDominant
                    ? `rgba(239, 68, 68, ${0.1 + (intensity / 100) * 0.2})`
                    : `rgba(34, 197, 94, ${0.1 + (intensity / 100) * 0.2})`}`
                }}
              >
                <div className="flex items-center gap-1 relative z-10">
                  <span className="text-white font-bold text-xs">{liq.symbol}</span>
                  {isWhale && <span className="badge-extreme text-[7px] py-0 px-1">WHALE</span>}
                </div>
                <span className={`relative z-10 font-mono font-bold ${
                  index < 3 ? 'text-sm' : 'text-[10px]'
                } ${isLongDominant ? 'text-red-300' : 'text-green-300'}`}>
                  {formatLiqValue(liq.totalValue)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-center gap-4 mt-3 text-[10px] text-neutral-500">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-1.5 rounded-full bg-red-500" />
          <span>Long Liq</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-1.5 rounded-full bg-green-500" />
          <span>Short Liq</span>
        </div>
      </div>
    </div>
  );
}
