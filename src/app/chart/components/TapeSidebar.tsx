'use client';

import React, { useEffect, useRef } from 'react';
import { Activity, Wifi, WifiOff, ChevronLeft, ChevronRight } from 'lucide-react';
import { useRealtimeTrades, RealtimeTrade, STATS_WINDOWS, type StatsWindow } from '@/hooks/useRealtimeTrades';
import { useSound } from '@/hooks/useSound';
import { formatUSD } from '@/lib/utils/format';

interface TapeSidebarProps {
  symbol: string;
  visible: boolean;
  onToggle: () => void;
}

const TradeRow = React.memo(function TradeRow({ trade }: { trade: RealtimeTrade }) {
  const isBig = trade.quoteQty >= 50_000;
  return (
    <div
      className={`flex items-center gap-1.5 px-2 py-[3px] text-[10px] font-mono transition-colors ${
        isBig ? (trade.isBuy ? 'bg-green-500/10' : 'bg-red-500/10') : ''
      }`}
    >
      <span className={`w-[52px] text-right font-bold ${trade.isBuy ? 'text-green-400' : 'text-red-400'}`}>
        ${trade.price >= 1000 ? trade.price.toFixed(0) : trade.price >= 1 ? trade.price.toFixed(2) : trade.price.toFixed(4)}
      </span>
      <span className="text-neutral-500 w-[50px] text-right">
        {trade.quoteQty >= 1000 ? `$${(trade.quoteQty / 1000).toFixed(1)}K` : `$${trade.quoteQty.toFixed(0)}`}
      </span>
      <span className="text-neutral-600 text-[9px]">
        {new Date(trade.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </span>
      {isBig && <span className="text-hub-yellow text-[8px]">BIG</span>}
    </div>
  );
});

export default function TapeSidebar({ symbol, visible, onToggle }: TapeSidebarProps) {
  // Pass bare symbol — useRealtimeTrades appends USDT internally
  const { trades, stats, connected, statsWindow, setStatsWindow } = useRealtimeTrades(visible ? symbol : '');
  const { playAlert } = useSound();
  const prevBigCountRef = useRef(0);

  // Sound alert for big trades ($100K+)
  useEffect(() => {
    if (!visible || trades.length === 0) return;
    const bigCount = trades.filter(t => t.quoteQty >= 100_000).length;
    if (bigCount > prevBigCountRef.current && prevBigCountRef.current > 0) {
      playAlert();
    }
    prevBigCountRef.current = bigCount;
  }, [trades, visible, playAlert]);

  return (
    <>
      {/* Toggle button — hidden on very small screens to avoid overlapping TradingView toolbar */}
      <button
        onClick={onToggle}
        aria-label={visible ? 'Hide trade tape' : 'Show live trade tape'}
        className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-[#0a0a0a] border border-white/[0.08] border-r-0 rounded-l-md p-1.5 hover:bg-white/[0.04] transition-colors group hidden sm:block"
      >
        {visible ? (
          <ChevronRight className="w-3 h-3 text-neutral-500 group-hover:text-white" />
        ) : (
          <ChevronLeft className="w-3 h-3 text-neutral-500 group-hover:text-white" />
        )}
      </button>

      {visible && (
        <aside className="w-[200px] flex-shrink-0 border-l border-white/[0.08] bg-[#060606] flex flex-col overflow-hidden" aria-label="Live trade tape">
          {/* Header */}
          <div className="flex items-center justify-between px-2 py-1.5 border-b border-white/[0.06]">
            <div className="flex items-center gap-1.5">
              <Activity className="w-3 h-3 text-hub-yellow" />
              <span className="text-[10px] font-semibold text-neutral-300">Live Tape</span>
              <span className="text-[8px] px-1 py-[1px] rounded bg-[#F0B90B]/10 text-[#F0B90B] font-medium">Binance</span>
            </div>
            <div className="flex items-center gap-1" aria-live="polite">
              {connected ? (
                <Wifi className="w-2.5 h-2.5 text-green-400" aria-label="Connected" />
              ) : (
                <>
                  <WifiOff className="w-2.5 h-2.5 text-red-400" aria-label="Disconnected" />
                  <span className="text-[8px] text-red-400/70 animate-pulse">reconnecting</span>
                </>
              )}
            </div>
          </div>

          {/* Time window tabs */}
          <div className="flex items-center gap-[2px] px-1.5 py-1 border-b border-white/[0.04]" role="tablist" aria-label="Stats time window">
            {STATS_WINDOWS.map(w => (
              <button
                key={w.key}
                role="tab"
                aria-selected={statsWindow === w.key}
                onClick={() => setStatsWindow(w.key)}
                className={`flex-1 px-1 py-[2px] rounded text-[8px] font-semibold transition-colors ${
                  statsWindow === w.key
                    ? 'bg-hub-yellow/15 text-hub-yellow'
                    : 'text-neutral-600 hover:text-neutral-400 hover:bg-white/[0.04]'
                }`}
              >
                {w.label}
              </button>
            ))}
          </div>

          {/* Stats bar */}
          {stats.tradeCount > 0 && (
            <div className="px-2 py-1 border-b border-white/[0.04] grid grid-cols-2 gap-x-2 gap-y-0.5">
              <div>
                <p className="text-[8px] text-neutral-600 uppercase">Buy Vol</p>
                <p className="text-[10px] font-mono text-green-400 font-bold">{formatUSD(stats.buyVolume)}</p>
              </div>
              <div>
                <p className="text-[8px] text-neutral-600 uppercase">Sell Vol</p>
                <p className="text-[10px] font-mono text-red-400 font-bold">{formatUSD(stats.sellVolume)}</p>
              </div>
              <div>
                <p className="text-[8px] text-neutral-600 uppercase">Net Delta</p>
                <p className={`text-[10px] font-mono font-bold ${stats.netDelta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {stats.netDelta >= 0 ? '+' : ''}{formatUSD(stats.netDelta)}
                </p>
              </div>
              <div>
                <p className="text-[8px] text-neutral-600 uppercase">Speed</p>
                <p className="text-[10px] font-mono text-neutral-300 font-bold">{stats.tradeSpeed}/s</p>
              </div>
            </div>
          )}

          {/* Trade list */}
          <div className="flex-1 overflow-y-auto scrollbar-thin" role="log" aria-label="Trade stream">
            {trades.length === 0 && connected && (
              <div className="flex items-center justify-center h-full">
                <span className="text-[10px] text-neutral-600 animate-pulse">Waiting for trades...</span>
              </div>
            )}
            {trades.length === 0 && !connected && (
              <div className="flex items-center justify-center h-full">
                <span className="text-[10px] text-neutral-600">Connecting...</span>
              </div>
            )}
            {trades.slice(0, 100).map((trade, i) => (
              <TradeRow key={`${trade.time}-${i}`} trade={trade} />
            ))}
          </div>

          {/* Delta bar at bottom */}
          {stats.buyVolume + stats.sellVolume > 0 && (
            <div className="flex-shrink-0 px-2 py-1 border-t border-white/[0.06]">
              <div className="flex h-1.5 rounded-full overflow-hidden bg-white/[0.04]" role="meter" aria-label="Buy/sell ratio" aria-valuenow={Math.round((stats.buyVolume / (stats.buyVolume + stats.sellVolume)) * 100)}>
                <div
                  className="bg-green-500/60 transition-all duration-300"
                  style={{ width: `${(stats.buyVolume / (stats.buyVolume + stats.sellVolume)) * 100}%` }}
                />
                <div
                  className="bg-red-500/60 transition-all duration-300"
                  style={{ width: `${(stats.sellVolume / (stats.buyVolume + stats.sellVolume)) * 100}%` }}
                />
              </div>
            </div>
          )}
        </aside>
      )}
    </>
  );
}
