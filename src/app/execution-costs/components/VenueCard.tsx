'use client';
import { VenueCost } from '@/lib/execution-costs/types';
import { EXCHANGE_BADGE_COLORS, getExchangeTradeUrl } from '@/lib/constants/exchanges';
import { formatUSD } from '@/lib/utils/format';
import { ExternalLink } from 'lucide-react';

interface Props { venue: VenueCost; rank: number; asset: string; }

export default function VenueCard({ venue, rank, asset }: Props) {
  const tradeUrl = getExchangeTradeUrl(venue.exchange, asset);
  const badgeColor = EXCHANGE_BADGE_COLORS[venue.exchange] || 'bg-neutral-500/20 text-neutral-400';

  if (!venue.available) {
    return (
      <div className="rounded-xl bg-white/[0.02] border border-white/[0.04] px-4 py-3 opacity-50">
        <div className="flex items-center gap-2 mb-2">
          <span className={`text-xs px-2 py-0.5 rounded-full ${badgeColor}`}>{venue.exchange}</span>
        </div>
        <p className="text-neutral-600 text-xs">{venue.error || 'Unavailable'}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] px-4 py-3 hover:bg-white/[0.05] transition-colors">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {rank <= 3 && <span className="text-lg">{rank === 1 ? '\u{1F947}' : rank === 2 ? '\u{1F948}' : '\u{1F949}'}</span>}
          <span className={`text-xs px-2 py-0.5 rounded-full ${badgeColor}`}>{venue.exchange}</span>
          <span className="text-[10px] text-neutral-600 uppercase">{venue.method.replace('_', ' ')}</span>
        </div>
      </div>
      <div className="text-xl font-bold text-white font-mono mb-2">{venue.totalCost.toFixed(4)}%</div>
      <div className="space-y-0.5 text-xs font-mono">
        <div className="flex justify-between"><span className="text-neutral-500">Fee</span><span className="text-neutral-300">{venue.fee.toFixed(4)}%</span></div>
        <div className="flex justify-between"><span className="text-neutral-500">Spread</span><span className="text-neutral-300">{venue.spread.toFixed(4)}%</span></div>
        <div className="flex justify-between"><span className="text-neutral-500">Impact</span><span className="text-neutral-300">{venue.priceImpact.toFixed(4)}%</span></div>
        {venue.midPrice > 0 && (
          <div className="flex justify-between mt-1 pt-1 border-t border-white/[0.04]">
            <span className="text-neutral-500">Exec Price</span>
            <span className="text-neutral-300">{formatUSD(venue.executionPrice, 2)}</span>
          </div>
        )}
      </div>
      {tradeUrl && (
        <a href={tradeUrl} target="_blank" rel="noopener noreferrer" className="mt-2 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-hub-yellow/10 text-hub-yellow text-xs font-medium hover:bg-hub-yellow/20 transition-colors">
          Trade Now <ExternalLink className="w-3 h-3" />
        </a>
      )}
    </div>
  );
}
