'use client';

import { memo } from 'react';
import { TokenIconSimple } from '@/components/TokenIcon';
import { ExchangeLogo } from '@/components/ExchangeLogos';
import { formatLiqValue } from '@/lib/utils/format';
import { getExchangeReferralUrl } from '@/lib/referralLinks';

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
const SHARK_THRESHOLD = 100_000;

function getValueStyle(value: number): string {
  if (value >= 1_000_000) return 'text-extreme-gradient';
  if (value >= WHALE_THRESHOLD) return 'text-rekt-hot';
  if (value >= SHARK_THRESHOLD) return 'text-orange-400';
  if (value >= 50_000) return 'text-amber-400';
  if (value >= 10_000) return 'text-yellow-400/90';
  if (value >= 1_000) return 'text-neutral-200';
  return 'text-neutral-500';
}

function getSizeBadge(value: number): { label: string; className: string } | null {
  if (value >= 1_000_000) return {
    label: 'MEGA',
    className: 'bg-red-500/15 text-red-400 ring-1 ring-red-500/20',
  };
  if (value >= WHALE_THRESHOLD) return {
    label: 'WHALE',
    className: 'badge-extreme',
  };
  if (value >= SHARK_THRESHOLD) return {
    label: 'SHARK',
    className: 'bg-orange-500/10 text-orange-400/90 ring-1 ring-orange-500/15',
  };
  return null;
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

  const tapeClass = isWhale
    ? 'rekt-tape-whale'
    : isLong
      ? 'rekt-tape-long'
      : 'rekt-tape-short';

  return (
    <div
      className={`rekt-tape-entry ${tapeClass} flex items-center gap-2 px-3 sm:px-4 py-2 hover:bg-white/[0.02] transition-colors ${
        isNew ? 'bg-hub-yellow/[0.03]' : ''
      }`}
    >
      {/* Side indicator */}
      <span
        className={`shrink-0 w-0.5 h-5 rounded-full ${
          isLong ? 'bg-red-500' : 'bg-green-500'
        } ${isWhale ? 'animate-pulse' : ''}`}
      />

      {/* Token */}
      <div className="flex items-center gap-1.5 min-w-0 w-16 sm:w-[76px] shrink-0">
        <TokenIconSimple symbol={symbol} size={16} />
        <span className="text-[13px] text-white font-semibold truncate">{symbol}</span>
      </div>

      {/* Value */}
      <span className={`flex-1 text-[13px] font-mono font-bold text-right tabular-nums ${getValueStyle(value)}`}>
        {formatLiqValue(value)}
      </span>

      {/* Size badge */}
      {(() => {
        const badge = getSizeBadge(value);
        return badge ? (
          <span className={`text-[7px] py-0.5 px-1.5 rounded font-bold shrink-0 uppercase tracking-wider ${badge.className}`}>
            {badge.label}
          </span>
        ) : null;
      })()}

      {/* Side label */}
      <span
        className={`shrink-0 w-9 text-center font-mono font-bold text-[10px] uppercase ${
          isLong ? 'text-red-400/80' : 'text-green-400/80'
        }`}
      >
        {isLong ? 'Long' : 'Short'}
      </span>

      {/* Exchange */}
      <div className="flex items-center gap-1 w-5 sm:w-[76px] shrink-0 overflow-hidden">
        <ExchangeLogo exchange={exchange} size={14} />
        {(() => {
          const ref = getExchangeReferralUrl(exchange);
          return ref ? (
            <a
              href={ref}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline text-neutral-500 hover:text-hub-yellow font-medium truncate transition-colors text-[11px]"
            >
              {exchange}
            </a>
          ) : (
            <span className="hidden sm:inline text-neutral-500 font-medium truncate text-[11px]">
              {exchange}
            </span>
          );
        })()}
      </div>

      {/* Time */}
      <span className="shrink-0 w-7 text-neutral-600 font-mono text-right text-[10px] tabular-nums">
        {formatTimeAgo(timestamp)}
      </span>
    </div>
  );
}

const LiquidationFeedRow = memo(LiquidationFeedRowInner);
export default LiquidationFeedRow;
