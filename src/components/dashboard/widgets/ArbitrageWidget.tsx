'use client';

import { useState, useEffect, useMemo } from 'react';
import { ArrowRight } from 'lucide-react';
import WidgetSkeleton from '../WidgetSkeleton';
import UpdatedAgo from '../UpdatedAgo';

interface FundingEntry {
  symbol: string;
  exchange: string;
  fundingRate: number;
}

interface ArbPair {
  symbol: string;
  longExchange: string;
  shortExchange: string;
  spread: number;
  longRate: number;
  shortRate: number;
}

export default function ArbitrageWidget({ wide }: { wide?: boolean }) {
  const [allPairs, setAllPairs] = useState<ArbPair[] | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await fetch('/api/funding?assetClass=crypto');
        if (!res.ok) return;
        const json = await res.json();
        const data: FundingEntry[] = json?.data || [];

        // Group by symbol
        const bySymbol: Record<string, FundingEntry[]> = {};
        for (const entry of data) {
          if (typeof entry.fundingRate !== 'number' || !isFinite(entry.fundingRate)) continue;
          if (!bySymbol[entry.symbol]) bySymbol[entry.symbol] = [];
          bySymbol[entry.symbol].push(entry);
        }

        // Find best arb for each symbol
        const pairs: ArbPair[] = [];
        for (const [symbol, entries] of Object.entries(bySymbol)) {
          if (entries.length < 2) continue;
          let minEntry = entries[0], maxEntry = entries[0];
          for (const e of entries) {
            if (e.fundingRate < minEntry.fundingRate) minEntry = e;
            if (e.fundingRate > maxEntry.fundingRate) maxEntry = e;
          }
          const spread = maxEntry.fundingRate - minEntry.fundingRate;
          if (spread > 0.001) {
            pairs.push({
              symbol,
              longExchange: minEntry.exchange,
              shortExchange: maxEntry.exchange,
              spread,
              longRate: minEntry.fundingRate,
              shortRate: maxEntry.fundingRate,
            });
          }
        }

        pairs.sort((a, b) => b.spread - a.spread);
        if (mounted) {
          setAllPairs(pairs);
          setUpdatedAt(Date.now());
        }
      } catch (err) { console.error('[Arbitrage] error:', err); }
    };
    load();
    const iv = setInterval(load, 30_000);
    return () => { mounted = false; clearInterval(iv); };
  }, []);

  const arbs = useMemo(() => allPairs?.slice(0, wide ? 8 : 5) ?? null, [allPairs, wide]);

  if (!arbs) return <WidgetSkeleton variant="list" />;

  return (
    <div>
      <div className="space-y-1.5">
        {arbs.length === 0 && (
          <p className="text-xs text-neutral-600 py-2">No significant arb opportunities</p>
        )}
        {arbs.map((a, i) => (
          <div key={i} className="flex items-center gap-2 text-xs py-1 border-b border-white/[0.03] last:border-0">
            <span className="font-bold text-white w-14 flex-shrink-0">{a.symbol}</span>
            <span className="text-neutral-500 truncate text-[10px]">{a.longExchange}</span>
            <ArrowRight className="w-3 h-3 text-neutral-600 flex-shrink-0" />
            <span className="text-neutral-500 truncate text-[10px]">{a.shortExchange}</span>
            <span className="ml-auto font-mono font-bold text-green-400 flex-shrink-0">
              {a.spread.toFixed(4)}%
            </span>
          </div>
        ))}
      </div>
      <div className="flex justify-end mt-1.5">
        <UpdatedAgo ts={updatedAt} />
      </div>
    </div>
  );
}
