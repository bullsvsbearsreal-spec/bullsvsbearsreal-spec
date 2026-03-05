'use client';

import { useState } from 'react';
import { ExternalLink, ChevronDown, ChevronRight, Calculator, Shield } from 'lucide-react';
import { ExchangeLogo } from '@/components/ExchangeLogos';
import { formatRateAdaptive } from '../../utils';
import { isExchangeDex, getExchangeTradeUrl } from '@/lib/constants';
import type { ArbitrageItem, FeasibilityGrade, EnrichedArb } from './types';
import { IntervalBadge } from './GradeBadge';
import { formatUSD, formatPrice, getIntervalForExchange, GRADE_COLORS } from './utils';
import { ProfitCalculator } from './ProfitCalculator';

export function ExchangeSide({ exchange, rate, symbol, periodScale, item, intervalMap, side }: {
  exchange: string; rate: number; symbol: string; periodScale: number; item: ArbitrageItem; intervalMap?: Map<string, string>; side: 'short' | 'long';
}) {
  const tradeUrl = getExchangeTradeUrl(exchange, symbol);
  const interval = getIntervalForExchange(item, exchange, intervalMap);
  const color = side === 'short' ? 'text-red-400' : 'text-green-400';
  return (
    <div className="flex items-center gap-1.5">
      <ExchangeLogo exchange={exchange.toLowerCase()} size={14} />
      <span className="text-xs text-neutral-300">{exchange}</span>
      {isExchangeDex(exchange) && <span className="px-1 py-0.5 rounded text-[8px] font-bold bg-purple-500/20 text-purple-400 leading-none">DEX</span>}
      <span className={`${color} font-mono text-[11px] ml-auto`}>
        {formatRateAdaptive(rate * periodScale)}<IntervalBadge interval={interval} />
      </span>
      {tradeUrl && (
        <a href={tradeUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-neutral-600 hover:text-hub-yellow transition-colors" title={`Trade on ${exchange}`}>
          <ExternalLink className="w-3 h-3" />
        </a>
      )}
    </div>
  );
}

export function ExpandedPanel({ item, periodScale, intervalMap }: {
  item: EnrichedArb; periodScale: number; intervalMap?: Map<string, string>;
}) {
  const [showCalc, setShowCalc] = useState(false);
  const exchangePrices = item.markPrices as Array<{ exchange: string; price: number }> | undefined;
  const hasPrices = exchangePrices && exchangePrices.length > 0;
  const avgPrice = hasPrices ? exchangePrices.reduce((s: number, p: { price: number }) => s + p.price, 0) / exchangePrices.length : 0;

  return (
    <div className="space-y-3">
      {/* 2-column layout on desktop */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left: Exchange Rates + Feasibility */}
        <div className="space-y-3">
          {/* All Exchange Rates */}
          <div>
            <div className="text-neutral-500 text-[10px] font-semibold uppercase tracking-wider mb-1.5">All Exchange Rates</div>
            <div className="flex flex-wrap gap-1.5">
              {item.sorted.map((ex: { exchange: string; rate: number }) => {
                const tradeUrl = getExchangeTradeUrl(ex.exchange, item.symbol);
                const interval = getIntervalForExchange(item, ex.exchange, intervalMap);
                return (
                  <div key={ex.exchange} className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/[0.03] border border-white/[0.04]">
                    <ExchangeLogo exchange={ex.exchange.toLowerCase()} size={14} />
                    <span className="text-neutral-400 text-[11px]">{ex.exchange}</span>
                    {isExchangeDex(ex.exchange) && <span className="px-0.5 py-0.5 rounded text-[8px] font-bold bg-purple-500/20 text-purple-400 leading-none">DEX</span>}
                    <span className={`font-mono text-[11px] font-semibold ${ex.rate >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {formatRateAdaptive(ex.rate * periodScale)}<IntervalBadge interval={interval} />
                    </span>
                    {tradeUrl && (
                      <a href={tradeUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-neutral-600 hover:text-hub-yellow transition-colors">
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          {/* Feasibility Summary */}
          {(item.maxPractical > 0 || item.stability) && (
            <div className="flex flex-wrap items-center gap-3 text-[10px] bg-white/[0.02] rounded-lg p-2.5 border border-white/[0.04]">
              {item.maxPractical > 0 && (
                <span className="text-neutral-500">
                  <Shield className="w-3 h-3 inline mr-0.5 -mt-0.5" />
                  Max practical: <span className="text-white font-mono">{formatUSD(item.maxPractical)}</span>
                  <span className="text-neutral-700 ml-1">(5% of min-side OI)</span>
                </span>
              )}
              {item.stability && item.stability !== 'new' && (
                <span className="text-neutral-500">
                  Stability: <span className={item.stability === 'stable' ? 'text-green-400' : 'text-amber-400'}>{item.stability}</span>
                </span>
              )}
              {item.trend && (
                <span className="text-neutral-500">
                  Trend: <span className={item.trend === 'widening' ? 'text-green-400' : item.trend === 'narrowing' ? 'text-red-400' : 'text-neutral-400'}>{item.trend}</span>
                </span>
              )}
              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${GRADE_COLORS[item.grade as FeasibilityGrade]}`}>
                Grade {item.grade} ({item.gradeScore}/8)
              </span>
            </div>
          )}
        </div>
        {/* Right: Price Comparison */}
        {hasPrices && (
          <div>
            <div className="text-neutral-500 text-[10px] font-semibold uppercase tracking-wider mb-1.5">Price Comparison</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {[...exchangePrices]
                .sort((a: { price: number }, b: { price: number }) => b.price - a.price)
                .map((ep: { exchange: string; price: number }) => {
                  const deviation = avgPrice > 0 ? ((ep.price - avgPrice) / avgPrice) * 100 : 0;
                  const isHighest = ep.price === Math.max(...exchangePrices.map((p: { price: number }) => p.price));
                  const isLowest = ep.price === Math.min(...exchangePrices.map((p: { price: number }) => p.price));
                  return (
                    <div key={ep.exchange} className={`px-2 py-1.5 rounded-md border ${isHighest ? 'bg-green-500/5 border-green-500/20' : isLowest ? 'bg-red-500/5 border-red-500/20' : 'bg-white/[0.02] border-white/[0.04]'}`}>
                      <div className="flex items-center gap-1 mb-0.5">
                        <ExchangeLogo exchange={ep.exchange.toLowerCase()} size={12} />
                        <span className="text-neutral-400 text-[10px]">{ep.exchange}</span>
                      </div>
                      <div className="text-white font-mono text-xs">{formatPrice(ep.price)}</div>
                      <div className={`font-mono text-[9px] ${deviation > 0 ? 'text-green-400' : deviation < 0 ? 'text-red-400' : 'text-neutral-600'}`}>
                        {deviation > 0 ? '+' : ''}{deviation.toFixed(3)}%
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>
      {/* Profit Calculator — full width below */}
      <div>
        <button onClick={() => setShowCalc(!showCalc)} className="flex items-center gap-1.5 text-neutral-500 hover:text-white text-[11px] transition-colors">
          <Calculator className="w-3.5 h-3.5" />
          <span>{showCalc ? 'Hide' : 'Show'} Profit Calculator</span>
          {showCalc ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </button>
        {showCalc && (
          <ProfitCalculator
            grossSpread8h={item.grossSpread8h}
            roundTripFee={item.roundTripFee}
            highExchange={item.high.exchange}
            lowExchange={item.low.exchange}
          />
        )}
      </div>
    </div>
  );
}
