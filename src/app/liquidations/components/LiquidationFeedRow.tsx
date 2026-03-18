'use client';

import { memo } from 'react';
import { TokenIconSimple } from '@/components/TokenIcon';
import { ExchangeLogo } from '@/components/ExchangeLogos';
import { formatLiqValue } from '@/lib/utils/format';

interface FeedRowProps {
  symbol: string;
  side: 'long' | 'short';
  value: number;
  exchange: string;
  timestamp: number;
  isNew?: boolean;
  tick?: number;
}

const WHALE_THRESHOLD = 500_000;

function getValueColor(value: number): string {
  if (value >= 1_000_000) return 'text-extreme-gradient';
  if (value >= WHALE_THRESHOLD) return 'text-rekt-hot';
  if (value >= 100_000) return 'text-orange-400';
  if (value >= 10_000) return 'text-yellow-400';
  return 'text-neutral-300';
}

function formatTimeAgo(ts: number): string {
  const diff = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function LiquidationFeedRowInner({
  symbol,
  side,
  value,
  exchange,
  timestamp,
  isNew,
}: FeedRowProps) {
  const isLong = side === 'long';
  const isWhale = value >= WHALE_THRESHOLD;

  // Determine rekt tape class
  const tapeClass = isWhale
    ? 'rekt-tape-whale'
    : isLong
      ? 'rekt-tape-long'
      : 'rekt-tape-short';

  return (
    <div
      className={`rekt-tape-entry ${tapeClass} flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 h-8 border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors ${
        isNew ? 'bg-hub-yellow/[0.04]' : ''
      }`}
    >
      {/* Side dot */}
      <span
        className={`shrink-0 rounded-full ${isLong ? 'bg-red-500' : 'bg-green-500'} ${isWhale ? 'animate-pulse' : ''}`}
        style={{ width: 6, height: 6 }}
      />

      {/* Token icon + symbol */}
      <div className="flex items-center gap-1 min-w-0 w-14 sm:w-[72px] shrink-0">
        <TokenIconSimple symbol={symbol} size={14} />
        <span className="text-white text-xs font-mono truncate">{symbol}</span>
      </div>

      {/* Value — upgraded with intensity */}
      <span className={`flex-1 text-xs font-mono font-bold text-right ${getValueColor(value)}`}>
        {formatLiqValue(value)}
      </span>

      {/* Whale badge */}
      {isWhale && (
        <span className="badge-extreme text-[7px] py-0 px-1 shrink-0">WHALE</span>
      )}

      {/* Side label */}
      <span
        className={`shrink-0 w-7 sm:w-8 text-center font-mono font-bold ${isLong ? 'text-red-400' : 'text-green-400'}`}
        style={{ fontSize: 10 }}
      >
        {isLong ? 'LONG' : 'SHRT'}
      </span>

      {/* Exchange — hidden on small screens */}
      <div className="hidden sm:flex items-center gap-1 w-16 lg:w-[72px] shrink-0 overflow-hidden">
        <ExchangeLogo exchange={exchange} size={12} />
        <span className="text-neutral-500 font-mono truncate" style={{ fontSize: 10 }}>
          {exchange}
        </span>
      </div>

      {/* Time ago */}
      <span className="shrink-0 w-6 sm:w-7 text-neutral-600 font-mono text-right" style={{ fontSize: 10 }}>
        {formatTimeAgo(timestamp)}
      </span>
    </div>
  );
}

const LiquidationFeedRow = memo(LiquidationFeedRowInner);
export default LiquidationFeedRow;
