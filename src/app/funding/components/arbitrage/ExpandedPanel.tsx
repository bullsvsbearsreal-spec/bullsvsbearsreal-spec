'use client';

import { useState, useMemo, useEffect } from 'react';
import { ExternalLink, ChevronDown, ChevronRight, Calculator, Shield, BarChart3, Clock } from 'lucide-react';
import { ExchangeLogo } from '@/components/ExchangeLogos';
import { formatRateAdaptive } from '../../utils';
import { isExchangeDex, getExchangeTradeUrl } from '@/lib/constants';
import type { ArbitrageItem, FeasibilityGrade, EnrichedArb } from './types';
import { IntervalBadge } from './GradeBadge';
import { formatUSD, formatPrice, getIntervalForExchange, GRADE_COLORS, getGradeBreakdown } from './utils';
import { ProfitCalculator } from './ProfitCalculator';

function formatCountdown(ms: number): string {
  if (ms <= 0) return 'now';
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function FundingCountdown({ nextTime }: { nextTime?: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  if (!nextTime || nextTime <= 0) return null;
  // Guard against bad data: nextTime should be a reasonable ms timestamp (within ~48h from now)
  const MAX_REASONABLE = 48 * 3600_000;
  const remaining = nextTime - now;
  if (remaining <= 0) return <span className="text-green-400 text-[9px] font-mono">settling</span>;
  if (remaining > MAX_REASONABLE) return null; // bad data, don't display
  const color = remaining < 900_000 ? 'text-red-400' : remaining < 3_600_000 ? 'text-amber-400' : 'text-neutral-500';
  return <span className={`${color} text-[9px] font-mono`}>{formatCountdown(remaining)}</span>;
}

export function ExchangeSide({ exchange, rate, symbol, periodScale, item, intervalMap, side }: {
  exchange: string; rate: number; symbol: string; periodScale: number; item: ArbitrageItem; intervalMap?: Map<string, string>; side: 'short' | 'long';
}) {
  const tradeUrl = getExchangeTradeUrl(exchange, symbol);
  const interval = getIntervalForExchange(item, exchange, intervalMap);
  const color = side === 'short' ? 'text-red-400' : 'text-green-400';
  const nextFundingTime = item.nextFundingTimes?.[exchange];
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <ExchangeLogo exchange={exchange.toLowerCase()} size={14} />
      <div className="flex flex-col min-w-0">
        <div className="flex items-center gap-1">
          <span className="text-xs text-neutral-300 truncate">{exchange}</span>
          {isExchangeDex(exchange) && <span className="px-1 py-0.5 rounded text-[8px] font-bold bg-purple-500/20 text-purple-400 leading-none shrink-0">DEX</span>}
          <FundingCountdown nextTime={nextFundingTime} />
        </div>
      </div>
      <span className={`${color} font-mono text-[11px] ml-auto shrink-0`}>
        {formatRateAdaptive(rate * periodScale)}<IntervalBadge interval={interval} />
      </span>
      {tradeUrl && (
        <a href={tradeUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-neutral-600 hover:text-hub-yellow transition-colors shrink-0" title={`Trade on ${exchange}`}>
          <ExternalLink className="w-3 h-3" />
        </a>
      )}
    </div>
  );
}

/** 24h funding settlement timeline visualization */
function FundingTimeline({ exchanges, nextFundingTimes, intervals, highExchange, lowExchange }: {
  exchanges: { exchange: string; rate: number }[];
  nextFundingTimes: Record<string, number>;
  intervals?: Record<string, string>;
  highExchange: string;
  lowExchange: string;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Build timeline entries for each exchange
  const WINDOW = 24 * 3600_000; // 24h window
  const timelineStart = now;
  const timelineEnd = now + WINDOW;

  const allRows = exchanges
    .filter(ex => nextFundingTimes[ex.exchange])
    .map(ex => {
      const interval = intervals?.[ex.exchange] || '8h';
      const intervalMs = interval === '1h' ? 3_600_000 : interval === '4h' ? 14_400_000 : 28_800_000;
      const nextTime = nextFundingTimes[ex.exchange];

      // Generate funding settlement points within window
      const points: number[] = [];
      // Work backwards to find the first point before/at now, then fill forward
      let t = nextTime;
      while (t > timelineStart) t -= intervalMs;
      t += intervalMs; // first point after start
      while (t <= timelineEnd) {
        points.push(t);
        t += intervalMs;
      }

      const side = ex.exchange === highExchange ? 'short' as const : ex.exchange === lowExchange ? 'long' as const : null;
      const nextSettlement = points.find(p => p > now) || 0;

      return { exchange: ex.exchange, interval, points, side, nextSettlement };
    })
    .sort((a, b) => (a.nextSettlement || Infinity) - (b.nextSettlement || Infinity));

  if (allRows.length === 0) return null;

  // Prioritize: arb sides first, then next to settle, cap at 8 rows
  const sideRows = allRows.filter(r => r.side);
  const otherRows = allRows.filter(r => !r.side);
  const rows = [...sideRows, ...otherRows].slice(0, 8);
  const hiddenCount = allRows.length - rows.length;

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <Clock className="w-3 h-3 text-hub-yellow" />
        <span className="text-neutral-500 text-[10px] font-semibold uppercase tracking-wider">Funding Settlement Timeline</span>
        <span className="text-neutral-700 text-[9px]">(next 24h)</span>
      </div>
      <div className="space-y-0.5">
        {rows.map(({ exchange, interval, points, side }) => {
          const sideColor = side === 'short' ? 'bg-red-500' : side === 'long' ? 'bg-green-500' : 'bg-neutral-500';
          const intervalColor = interval === '1h' ? 'text-amber-400' : interval === '4h' ? 'text-blue-400' : 'text-neutral-500';
          return (
            <div key={exchange} className="flex items-center gap-1.5">
              <div className="flex items-center gap-1 w-20 flex-shrink-0">
                <ExchangeLogo exchange={exchange.toLowerCase()} size={12} />
                <span className="text-neutral-400 text-[10px] truncate">{exchange}</span>
              </div>
              <span className={`text-[8px] font-mono ${intervalColor} w-5 flex-shrink-0`}>{interval}</span>
              <div className="flex-1 h-4 bg-white/[0.02] rounded relative border border-white/[0.04]">
                {/* Now marker */}
                <div className="absolute left-0 top-0 bottom-0 w-px bg-hub-yellow/40" />
                {points.map((t, i) => {
                  const pct = ((t - timelineStart) / WINDOW) * 100;
                  const isPast = t <= now;
                  const isNext = !isPast && (i === 0 || points[i - 1] <= now);
                  return (
                    <div
                      key={i}
                      className={`absolute top-1/2 -translate-y-1/2 rounded-full ${
                        isPast ? 'bg-neutral-700' : isNext ? `${sideColor} ring-2 ring-white/20` : sideColor + '/50'
                      }`}
                      style={{ left: `${Math.min(pct, 99)}%`, width: isNext ? 7 : 4, height: isNext ? 7 : 4 }}
                      title={`${exchange} settlement at ${new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                    />
                  );
                })}
              </div>
              <FundingCountdown nextTime={points.find(p => p > now)} />
            </div>
          );
        })}
      </div>
      {/* Time axis labels */}
      <div className="flex justify-between mt-0.5 text-[8px] text-neutral-700 font-mono pl-28">
        <span>now</span>
        <span>+6h</span>
        <span>+12h</span>
        <span>+18h</span>
        <span>+24h</span>
      </div>
      {hiddenCount > 0 && (
        <div className="text-[8px] text-neutral-700 mt-0.5">+{hiddenCount} more exchanges</div>
      )}
    </div>
  );
}

// Supported exchanges for orderbook fetching
const DEPTH_EXCHANGES = new Set([
  'Binance', 'Bybit', 'OKX', 'Bitget',
  'Hyperliquid', 'dYdX', 'Drift', 'Aster', 'Aevo', 'Lighter',
]);

interface DepthData {
  venues: Array<{
    exchange: string;
    available: boolean;
    midPrice: number;
    bidDepthUsd: number;
    askDepthUsd: number;
    slippage: Record<number, { bid: number; ask: number }>;
    error?: string;
  }>;
  depthSizes: number[];
}

/** Lazy-loaded liquidity depth section */
function LiquidityDepth({ symbol, exchanges, highExchange, lowExchange }: {
  symbol: string; exchanges: string[]; highExchange: string; lowExchange: string;
}) {
  const [showDepth, setShowDepth] = useState(false);
  const [depthData, setDepthData] = useState<DepthData | null>(null);
  const [loading, setLoading] = useState(false);

  const supportedExchanges = useMemo(
    () => exchanges.filter(e => DEPTH_EXCHANGES.has(e)),
    [exchanges],
  );

  const fetchDepth = async () => {
    if (depthData || loading || supportedExchanges.length === 0) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/orderbook/multi?symbol=${symbol}&exchanges=${supportedExchanges.join(',')}`);
      if (res.ok) {
        const data = await res.json();
        setDepthData(data);
      }
    } catch { /* silent */ }
    setLoading(false);
  };

  const handleToggle = () => {
    const next = !showDepth;
    setShowDepth(next);
    if (next) fetchDepth();
  };

  if (supportedExchanges.length === 0) return null;

  return (
    <div>
      <button onClick={handleToggle} className="flex items-center gap-1.5 text-neutral-500 hover:text-white text-[11px] transition-colors">
        <BarChart3 className="w-3.5 h-3.5" />
        <span>{showDepth ? 'Hide' : 'Show'} Liquidity Depth</span>
        {showDepth ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        {loading && <span className="text-hub-yellow text-[9px] animate-pulse">Loading...</span>}
      </button>
      {showDepth && depthData && (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-[10px]">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left py-1.5 px-2 text-neutral-500 font-semibold">Exchange</th>
                <th className="text-right py-1.5 px-2 text-neutral-500 font-semibold">Bid Depth</th>
                <th className="text-right py-1.5 px-2 text-neutral-500 font-semibold">Ask Depth</th>
                {depthData.depthSizes.map(size => (
                  <th key={size} className="text-right py-1.5 px-2 text-neutral-500 font-semibold">
                    ${size >= 1000 ? `${size / 1000}K` : size}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {depthData.venues.filter(v => v.available).map(venue => {
                const side = venue.exchange === highExchange ? 'short' : venue.exchange === lowExchange ? 'long' : null;
                return (
                  <tr key={venue.exchange} className="border-b border-white/[0.03]">
                    <td className="py-1.5 px-2">
                      <div className="flex items-center gap-1.5">
                        <ExchangeLogo exchange={venue.exchange.toLowerCase()} size={12} />
                        <span className="text-neutral-300">{venue.exchange}</span>
                        {side && (
                          <span className={`text-[8px] font-bold px-1 py-0.5 rounded leading-none ${
                            side === 'short' ? 'bg-red-500/15 text-red-400' : 'bg-green-500/15 text-green-400'
                          }`}>
                            {side === 'short' ? 'S' : 'L'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="text-right py-1.5 px-2 font-mono text-neutral-400">{formatUSD(venue.bidDepthUsd)}</td>
                    <td className="text-right py-1.5 px-2 font-mono text-neutral-400">{formatUSD(venue.askDepthUsd)}</td>
                    {depthData.depthSizes.map(size => {
                      const slip = venue.slippage[size];
                      if (!slip) return <td key={size} className="text-right py-1.5 px-2 text-neutral-700">-</td>;
                      // Show the relevant side: short side cares about bid (selling), long side about ask (buying)
                      const val = side === 'short' ? slip.bid : side === 'long' ? slip.ask : Math.max(slip.bid, slip.ask);
                      const color = val > 0.5 ? 'text-red-400' : val > 0.1 ? 'text-amber-400' : 'text-green-400';
                      return (
                        <td key={size} className={`text-right py-1.5 px-2 font-mono ${color}`}>
                          {val.toFixed(3)}%
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="mt-1 text-[9px] text-neutral-700">
            Slippage = spread + price impact for a market order of given USD size. Green &lt; 0.1%, Amber &lt; 0.5%, Red &gt; 0.5%.
          </div>
        </div>
      )}
    </div>
  );
}

export function ExpandedPanel({ item, periodScale, intervalMap, oiMap }: {
  item: EnrichedArb; periodScale: number; intervalMap?: Map<string, string>; oiMap?: Map<string, number>;
}) {
  const [showCalc, setShowCalc] = useState(false);
  const exchangePrices = item.markPrices as Array<{ exchange: string; price: number }> | undefined;
  const hasPrices = exchangePrices && exchangePrices.length > 0;
  const avgPrice = hasPrices ? exchangePrices.reduce((s: number, p: { price: number }) => s + p.price, 0) / exchangePrices.length : 0;

  // Per-exchange OI data for breakdown
  const exchangeOI = useMemo(() => {
    if (!oiMap) return [];
    return item.sorted.map((ex: { exchange: string; rate: number }) => ({
      exchange: ex.exchange,
      oi: oiMap.get(`${item.symbol}|${ex.exchange}`) || 0,
      isSide: ex.exchange === item.high.exchange || ex.exchange === item.low.exchange,
      side: ex.exchange === item.high.exchange ? 'short' as const : ex.exchange === item.low.exchange ? 'long' as const : null,
    })).filter(e => e.oi > 0).sort((a, b) => b.oi - a.oi);
  }, [oiMap, item.sorted, item.symbol, item.high.exchange, item.low.exchange]);
  const maxOI = exchangeOI.length > 0 ? Math.max(...exchangeOI.map(e => e.oi)) : 0;

  return (
    <div className="space-y-2.5">
      {/* Feasibility Summary — always top, full width */}
      {(item.maxPractical > 0 || item.stability) && (() => {
        const breakdown = getGradeBreakdown({
          spreadPct8h: item.grossSpread8h,
          minSideOI: item.minSideOI,
          stability: item.stability,
          roundTripFee: item.roundTripFee,
          highOI: item.highOI,
          lowOI: item.lowOI,
          highInterval: item.highInterval,
          lowInterval: item.lowInterval,
          netAnnualized: item.netAnnualized,
        });
        return (
          <div className="bg-white/[0.02] rounded-lg border border-white/[0.04] overflow-hidden">
            {/* Top row: grade + key stats */}
            <div className="px-3 py-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px]">
              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${GRADE_COLORS[item.grade as FeasibilityGrade]}`}>
                {item.grade} ({item.gradeScore}/10)
              </span>
              {item.maxPractical > 0 && (
                <span className="text-neutral-500">Max: <span className="text-white font-mono">{formatUSD(item.maxPractical)}</span></span>
              )}
              <span className="text-neutral-500">
                Fees: <span className={`font-mono ${item.feeImpactPct > 50 ? 'text-red-400' : item.feeImpactPct > 30 ? 'text-amber-400' : 'text-neutral-400'}`}>{item.roundTripFee.toFixed(3)}%</span>
                <span className="text-neutral-700"> ({item.feeImpactPct.toFixed(0)}%)</span>
              </span>
              <span className="text-neutral-600">|</span>
              <span className="text-neutral-500">
                Short: <span className={`font-mono ${item.shortDailyRate > 0 ? 'text-green-400' : 'text-red-400'}`}>{item.shortDailyRate > 0 ? '+' : ''}{item.shortDailyRate.toFixed(4)}%</span>/d
              </span>
              <span className="text-neutral-500">
                Long: <span className={`font-mono ${item.longDailyRate <= 0 ? 'text-green-400' : 'text-red-400'}`}>{item.longDailyRate <= 0 ? '+' : ''}{(-item.longDailyRate).toFixed(4)}%</span>/d
              </span>
              {item.stability && item.stability !== 'new' && (
                <span className={item.stability === 'stable' ? 'text-green-400/80' : 'text-amber-400/80'}>{item.stability}</span>
              )}
              {item.trend && item.trend !== 'flat' && (
                <span className={item.trend === 'widening' ? 'text-green-400/80' : 'text-red-400/80'}>{item.trend}</span>
              )}
            </div>
            {/* Grade Breakdown — why this grade */}
            <div className="border-t border-white/[0.04] px-3 py-2">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Shield className="w-3 h-3 text-hub-yellow" />
                <span className="text-neutral-500 text-[10px] font-semibold uppercase tracking-wider">Grade Breakdown</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1">
                {breakdown.map((row, i) => (
                  <div key={i} className="flex items-center gap-2 text-[10px]">
                    <span className="text-neutral-500 w-20 shrink-0">{row.label}</span>
                    <div className="flex-1 flex items-center gap-1">
                      {/* Mini score bar */}
                      {row.max > 0 && (
                        <div className="w-10 h-1.5 bg-white/[0.04] rounded-full overflow-hidden shrink-0">
                          <div
                            className={`h-full rounded-full ${row.score >= row.max ? 'bg-green-500' : row.score > 0 ? 'bg-amber-500' : 'bg-red-500'}`}
                            style={{ width: `${Math.max((row.score / row.max) * 100, 0)}%` }}
                          />
                        </div>
                      )}
                      {row.score < 0 && (
                        <span className="text-red-400 text-[9px] font-mono shrink-0">-1</span>
                      )}
                      <span className={`${row.color} truncate`}>{row.value}</span>
                    </div>
                  </div>
                ))}
              </div>
              {/* Warning flags */}
              {item.gradeFlags && item.gradeFlags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5 pt-1.5 border-t border-white/[0.03]">
                  {item.gradeFlags.map((flag, i) => (
                    <span key={i} className="text-[8px] px-1 py-0.5 rounded bg-amber-500/10 text-amber-400/80 border border-amber-500/10">⚠ {flag}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })()}
      {/* 3-column layout: Exchange Rates | OI Bars | Price Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Col 1: All Exchange Rates */}
        <div>
          <div className="text-neutral-500 text-[10px] font-semibold uppercase tracking-wider mb-1">All Exchange Rates</div>
          <div className="flex flex-wrap gap-1">
            {item.sorted.map((ex: { exchange: string; rate: number }) => {
              const tradeUrl = getExchangeTradeUrl(ex.exchange, item.symbol);
              const interval = getIntervalForExchange(item, ex.exchange, intervalMap);
              return (
                <div key={ex.exchange} className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/[0.03] border border-white/[0.04]">
                  <ExchangeLogo exchange={ex.exchange.toLowerCase()} size={12} />
                  <span className="text-neutral-400 text-[10px]">{ex.exchange}</span>
                  {isExchangeDex(ex.exchange) && <span className="px-0.5 rounded text-[7px] font-bold bg-purple-500/20 text-purple-400 leading-none">DEX</span>}
                  <span className={`font-mono text-[10px] font-semibold ${ex.rate >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {formatRateAdaptive(ex.rate * periodScale)}<IntervalBadge interval={interval} />
                  </span>
                  {tradeUrl && (
                    <a href={tradeUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-neutral-600 hover:text-hub-yellow transition-colors">
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        {/* Col 2: Open Interest by Exchange */}
        {exchangeOI.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <BarChart3 className="w-3 h-3 text-blue-400" />
              <span className="text-neutral-500 text-[10px] font-semibold uppercase tracking-wider">Open Interest</span>
            </div>
            <div className="space-y-0.5">
              {exchangeOI.slice(0, 10).map(({ exchange, oi, side }) => {
                const pct = maxOI > 0 ? (oi / maxOI) * 100 : 0;
                const sideLabel = side === 'short' ? 'S' : side === 'long' ? 'L' : null;
                const barColor = side === 'short' ? 'bg-red-500/30' : side === 'long' ? 'bg-green-500/30' : 'bg-white/[0.06]';
                const textColor = oi < 100_000 ? 'text-red-400' : oi < 500_000 ? 'text-amber-400' : 'text-neutral-300';
                return (
                  <div key={exchange} className="flex items-center gap-1">
                    <div className="flex items-center gap-0.5 w-[72px] flex-shrink-0">
                      <ExchangeLogo exchange={exchange.toLowerCase()} size={11} />
                      <span className="text-neutral-400 text-[9px] truncate">{exchange}</span>
                      {sideLabel && (
                        <span className={`text-[7px] font-bold px-0.5 rounded leading-none ${side === 'short' ? 'bg-red-500/15 text-red-400' : 'bg-green-500/15 text-green-400'}`}>{sideLabel}</span>
                      )}
                    </div>
                    <div className="flex-1 h-2.5 bg-white/[0.02] rounded overflow-hidden">
                      <div className={`h-full ${barColor} rounded`} style={{ width: `${Math.max(pct, 2)}%` }} />
                    </div>
                    <span className={`font-mono text-[9px] w-12 text-right flex-shrink-0 ${textColor}`}>{formatUSD(oi)}</span>
                  </div>
                );
              })}
            </div>
            {item.minSideOI > 0 && (
              <div className="mt-1 text-[8px] text-neutral-600">
                Min-side: <span className="text-neutral-400 font-mono">{formatUSD(item.minSideOI)}</span>
              </div>
            )}
          </div>
        )}
        {/* Col 3: Price Comparison — compact table */}
        {hasPrices && (
          <div>
            <div className="text-neutral-500 text-[10px] font-semibold uppercase tracking-wider mb-1">Price Comparison</div>
            <div className="space-y-0.5">
              {[...exchangePrices]
                .sort((a: { price: number }, b: { price: number }) => b.price - a.price)
                .slice(0, 10)
                .map((ep: { exchange: string; price: number }) => {
                  const deviation = avgPrice > 0 ? ((ep.price - avgPrice) / avgPrice) * 100 : 0;
                  return (
                    <div key={ep.exchange} className="flex items-center gap-1.5 text-[10px]">
                      <div className="flex items-center gap-1 w-[72px] flex-shrink-0">
                        <ExchangeLogo exchange={ep.exchange.toLowerCase()} size={11} />
                        <span className="text-neutral-400 text-[9px] truncate">{ep.exchange}</span>
                      </div>
                      <span className="text-white font-mono text-[10px]">{formatPrice(ep.price)}</span>
                      <span className={`font-mono text-[9px] ml-auto ${deviation > 0 ? 'text-green-400' : deviation < 0 ? 'text-red-400' : 'text-neutral-600'}`}>
                        {deviation > 0 ? '+' : ''}{deviation.toFixed(3)}%
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>
      {/* Funding Settlement Timeline */}
      {item.nextFundingTimes && Object.keys(item.nextFundingTimes).length > 0 && (
        <FundingTimeline exchanges={item.sorted} nextFundingTimes={item.nextFundingTimes} intervals={item.intervals} highExchange={item.high.exchange} lowExchange={item.low.exchange} />
      )}
      {/* Liquidity Depth */}
      <LiquidityDepth symbol={item.symbol} exchanges={item.sorted.map(e => e.exchange)} highExchange={item.high.exchange} lowExchange={item.low.exchange} />
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
