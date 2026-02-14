'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useMultiExchangeLiquidations } from '@/hooks/useMultiExchangeLiquidations';
import { ExchangeLogo } from '@/components/ExchangeLogos';
import { AlertTriangle, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { formatLiqValue, formatPrice, formatRelativeTime } from '@/lib/utils/format';

const AVAILABLE_EXCHANGES = ['Binance', 'Bybit', 'OKX', 'Bitget', 'Deribit', 'MEXC', 'BingX'] as const;

const VALUE_THRESHOLDS = [
  { label: '$100K', value: 100_000 },
  { label: '$500K', value: 500_000 },
  { label: '$1M', value: 1_000_000 },
  { label: '$5M', value: 5_000_000 },
] as const;

export default function WhaleAlertPage() {
  const [minValue, setMinValue] = useState(100_000);
  const [selectedExchanges, setSelectedExchanges] = useState<string[]>([...AVAILABLE_EXCHANGES]);
  const [, setTick] = useState(0);
  const feedRef = useRef<HTMLDivElement>(null);

  // Stabilize exchange array reference to avoid unnecessary reconnects
  const exchangeKey = selectedExchanges.join(',');
  const stableExchanges = useMemo(() => selectedExchanges, [exchangeKey]);

  const { liquidations, connections, stats, clearAll } = useMultiExchangeLiquidations({
    exchanges: stableExchanges,
    minValue: 0, // fetch all, filter client-side so stats stay accurate
    maxItems: 500,
  });

  // Tick every 5s to keep "time ago" labels fresh
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 5000);
    return () => clearInterval(timer);
  }, []);

  // Filter liquidations by threshold and selected exchanges (client-side)
  const filteredLiqs = useMemo(() => {
    return liquidations.filter(
      liq => liq.value >= minValue && selectedExchanges.includes(liq.exchange),
    );
  }, [liquidations, minValue, selectedExchanges]);

  // Auto-scroll to top on new items if user hasn't scrolled down
  useEffect(() => {
    if (feedRef.current && filteredLiqs.length > 0) {
      const el = feedRef.current;
      if (el.scrollTop < 100) {
        el.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  }, [filteredLiqs.length]);

  // Whale-specific stats (above threshold)
  const whaleStats = useMemo(() => {
    const totalValue = filteredLiqs.reduce((sum, l) => sum + l.value, 0);
    const longCount = filteredLiqs.filter(l => l.side === 'long').length;
    const shortCount = filteredLiqs.filter(l => l.side === 'short').length;
    const longValue = filteredLiqs.filter(l => l.side === 'long').reduce((s, l) => s + l.value, 0);
    const shortValue = filteredLiqs.filter(l => l.side === 'short').reduce((s, l) => s + l.value, 0);
    let biggest = filteredLiqs[0] || null;
    for (const l of filteredLiqs) {
      if (l.value > (biggest?.value || 0)) biggest = l;
    }
    return { count: filteredLiqs.length, totalValue, longCount, shortCount, longValue, shortValue, biggest };
  }, [filteredLiqs]);

  const connectedCount = connections.filter(c => c.connected).length;

  const toggleExchange = (exchange: string) => {
    setSelectedExchanges(prev => {
      if (prev.includes(exchange)) {
        return prev.length > 1 ? prev.filter(e => e !== exchange) : prev;
      }
      return [...prev, exchange];
    });
  };

  const longRatio = whaleStats.longValue + whaleStats.shortValue > 0
    ? (whaleStats.longValue / (whaleStats.longValue + whaleStats.shortValue)) * 100
    : 50;

  return (
    <div className="min-h-screen bg-black text-white">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 page-enter">
        {/* Page Title */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Whale Alert</h1>
              <p className="text-sm text-neutral-500">Large liquidations across exchanges in real-time</p>
            </div>
          </div>

          {/* Global connection status */}
          <div className="flex items-center gap-2 text-sm text-neutral-500">
            {connectedCount > 0 ? (
              <Wifi className="w-4 h-4 text-emerald-400" />
            ) : (
              <WifiOff className="w-4 h-4 text-red-400" />
            )}
            <span>{connectedCount}/{connections.length} connected</span>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Whale Count */}
          <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-4">
            <p className="text-xs text-neutral-500 mb-1">Whale Liquidations</p>
            <p className="text-2xl font-bold tabular-nums">{whaleStats.count}</p>
            <p className="text-xs text-neutral-500 mt-1">
              {whaleStats.longCount} longs / {whaleStats.shortCount} shorts
            </p>
          </div>

          {/* Total Value */}
          <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-4">
            <p className="text-xs text-neutral-500 mb-1">Total Value</p>
            <p className="text-2xl font-bold tabular-nums">{formatLiqValue(whaleStats.totalValue)}</p>
            <p className="text-xs text-neutral-500 mt-1">above {VALUE_THRESHOLDS.find(t => t.value === minValue)?.label}</p>
          </div>

          {/* Biggest Single */}
          <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-4">
            <p className="text-xs text-neutral-500 mb-1">Biggest Single Liq</p>
            <p className="text-2xl font-bold tabular-nums">
              {whaleStats.biggest ? formatLiqValue(whaleStats.biggest.value) : '--'}
            </p>
            {whaleStats.biggest && (
              <p className="text-xs text-neutral-500 mt-1">
                {whaleStats.biggest.symbol}{' '}
                <span className={whaleStats.biggest.side === 'long' ? 'text-emerald-400' : 'text-red-400'}>
                  {whaleStats.biggest.side.toUpperCase()}
                </span>
                {' '}on {whaleStats.biggest.exchange}
              </p>
            )}
          </div>

          {/* Long vs Short Ratio */}
          <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-4">
            <p className="text-xs text-neutral-500 mb-1">Long vs Short</p>
            <div className="flex items-end gap-2">
              <span className="text-lg font-bold text-emerald-400">{longRatio.toFixed(0)}%</span>
              <span className="text-neutral-500 text-sm">/</span>
              <span className="text-lg font-bold text-red-400">{(100 - longRatio).toFixed(0)}%</span>
            </div>
            <div className="mt-2 h-1.5 bg-neutral-800 rounded-full overflow-hidden flex">
              <div className="bg-emerald-400 h-full transition-all duration-500" style={{ width: `${longRatio}%` }} />
              <div className="bg-red-400 h-full transition-all duration-500" style={{ width: `${100 - longRatio}%` }} />
            </div>
          </div>
        </div>

        {/* Filters Row */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Value threshold buttons */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-neutral-500 mr-2">Min Value</span>
            {VALUE_THRESHOLDS.map(t => (
              <button
                key={t.value}
                onClick={() => setMinValue(t.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  minValue === t.value
                    ? 'bg-hub-yellow text-black'
                    : 'text-neutral-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="h-5 w-px bg-white/[0.06] hidden sm:block" />

          {/* Exchange filters */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-neutral-500 mr-1">Exchanges</span>
            {AVAILABLE_EXCHANGES.map(ex => {
              const conn = connections.find(c => c.exchange === ex);
              const isSelected = selectedExchanges.includes(ex);
              return (
                <button
                  key={ex}
                  onClick={() => toggleExchange(ex)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isSelected
                      ? 'bg-white/[0.08] text-white'
                      : 'bg-white/[0.02] text-neutral-600 hover:text-neutral-400'
                  }`}
                >
                  <span className="relative">
                    <ExchangeLogo exchange={ex} size={14} />
                    {/* Connection dot */}
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full border border-[#0d0d0d] ${
                        conn?.connected ? 'bg-emerald-400' : 'bg-red-400'
                      }`}
                    />
                  </span>
                  <span className="hidden sm:inline">{ex}</span>
                </button>
              );
            })}
          </div>

          <div className="ml-auto">
            <button
              onClick={clearAll}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-neutral-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] transition-colors"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Liquidation Feed */}
        <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl overflow-hidden">
          {/* Feed Header */}
          <div className="grid grid-cols-[2.5rem_1fr_5rem_6rem_5.5rem_4.5rem] sm:grid-cols-[2.5rem_1fr_5.5rem_7rem_6rem_5rem] gap-2 px-4 py-2.5 border-b border-white/[0.06] text-xs text-neutral-500 font-medium">
            <span />
            <span>Symbol</span>
            <span>Side</span>
            <span className="text-right">Value</span>
            <span className="text-right">Price</span>
            <span className="text-right">Time</span>
          </div>

          {/* Feed Body */}
          <div ref={feedRef} className="max-h-[600px] overflow-y-auto divide-y divide-white/[0.03]">
            {connectedCount === 0 && filteredLiqs.length === 0 ? (
              <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-xl p-12 text-center">
                <RefreshCw className="w-5 h-5 text-hub-yellow animate-spin mx-auto mb-2" />
                <span className="text-neutral-500 text-sm">Connecting to exchange feeds...</span>
                <p className="text-neutral-700 text-xs mt-1">Establishing WebSocket connections to 7 exchanges</p>
              </div>
            ) : filteredLiqs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-neutral-500">
                <AlertTriangle className="w-8 h-8 mb-3 text-neutral-600" />
                <p className="text-sm">No whale liquidations yet</p>
                <p className="text-xs mt-1 text-neutral-600">
                  Waiting for liquidations above {VALUE_THRESHOLDS.find(t => t.value === minValue)?.label}...
                </p>
              </div>
            ) : (
              filteredLiqs.map((liq, i) => (
                <LiquidationRow key={liq.id} liq={liq} isNew={i < 3} />
              ))
            )}
          </div>
        </div>

        {/* Connection Status Detail */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-500">
          <span className="font-medium">Connections:</span>
          {connections.map(c => (
            <span key={c.exchange} className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${c.connected ? 'bg-emerald-400' : 'bg-red-400'}`} />
              <span className={c.connected ? 'text-neutral-400' : 'text-neutral-600'}>
                {c.exchange}
              </span>
            </span>
          ))}
        </div>

        <div className="mt-4 p-3 rounded-lg bg-hub-yellow/5 border border-hub-yellow/10">
          <p className="text-neutral-500 text-xs leading-relaxed">
            Whale Alert monitors large liquidation events across 7 major exchanges in real-time via WebSocket feeds. A liquidation occurs when a leveraged position is forcefully closed due to insufficient margin. Large liquidations ($1M+) often signal significant market stress and can cascade into further price movements. Green dots indicate active exchange connections.
          </p>
        </div>
      </main>

      <Footer />

      {/* Fade-in animation keyframes */}
      <style jsx global>{`
        @keyframes whale-fade-in {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-whale-in {
          animation: whale-fade-in 0.4s ease-out;
        }
      `}</style>
    </div>
  );
}

function LiquidationRow({ liq, isNew }: { liq: { id: string; symbol: string; side: 'long' | 'short'; price: number; value: number; exchange: string; timestamp: number }; isNew: boolean }) {
  const isLong = liq.side === 'long';

  return (
    <div
      className={`grid grid-cols-[2.5rem_1fr_5rem_6rem_5.5rem_4.5rem] sm:grid-cols-[2.5rem_1fr_5.5rem_7rem_6rem_5rem] gap-2 px-4 py-3 items-center hover:bg-white/[0.02] transition-colors ${
        isNew ? 'animate-whale-in' : ''
      } ${liq.value >= 5_000_000 ? 'bg-red-500/[0.04]' : ''}`}
    >
      {/* Exchange Logo */}
      <div className="flex items-center justify-center">
        <ExchangeLogo exchange={liq.exchange} size={20} />
      </div>

      {/* Symbol */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="font-semibold text-sm truncate">{liq.symbol}</span>
        <span className="text-[10px] text-neutral-600 hidden sm:inline">{liq.exchange}</span>
      </div>

      {/* Side Badge */}
      <div>
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
            isLong
              ? 'bg-emerald-400/10 text-emerald-400'
              : 'bg-red-400/10 text-red-400'
          }`}
        >
          {liq.side}
        </span>
      </div>

      {/* Value */}
      <div className="text-right">
        <span className={`text-sm font-bold tabular-nums ${liq.value >= 1_000_000 ? 'text-yellow-400' : 'text-white'}`}>
          {formatLiqValue(liq.value)}
        </span>
      </div>

      {/* Price */}
      <div className="text-right text-sm text-neutral-400 tabular-nums">
        {formatPrice(liq.price)}
      </div>

      {/* Time Ago */}
      <div className="text-right text-xs text-neutral-500 tabular-nums">
        {formatRelativeTime(liq.timestamp)}
      </div>
    </div>
  );
}
