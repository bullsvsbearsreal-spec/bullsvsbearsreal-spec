'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Unlock } from 'lucide-react';
import WidgetSkeleton from '../WidgetSkeleton';
import UpdatedAgo from '../UpdatedAgo';
import { TokenIconSimple } from '@/components/TokenIcon';

interface UnlockItem {
  coinSymbol: string;
  unlockDate: string;
  unlockValue: number;
  percentOfSupply: number;
  isLarge: boolean;
  unlockType: string;
}

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmtValue(v: number): string {
  if (v >= 1e9) return '$' + (v / 1e9).toFixed(1) + 'B';
  if (v >= 1e6) return '$' + (v / 1e6).toFixed(0) + 'M';
  if (v >= 1e3) return '$' + (v / 1e3).toFixed(0) + 'K';
  return '$' + v.toFixed(0);
}

export default function TokenUnlocksWidget({ wide }: { wide?: boolean }) {
  const [unlocks, setUnlocks] = useState<UnlockItem[] | null>(null);
  const [priceSource, setPriceSource] = useState<string>('coingecko');
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await fetch('/api/token-unlocks');
        if (!res.ok) return;
        const json = await res.json();
        const items: UnlockItem[] = json?.unlocks || [];
        // Filter to future unlocks only, sort by date ascending
        const now = new Date().toISOString().slice(0, 10);
        const upcoming = items
          .filter((u) => u.unlockDate >= now)
          .sort((a, b) => a.unlockDate.localeCompare(b.unlockDate));
        if (mounted) {
          setUnlocks(upcoming.slice(0, wide ? 6 : 4));
          setPriceSource(json?.meta?.priceSource || 'coingecko');
          setUpdatedAt(Date.now());
        }
      } catch (err) { console.error('[TokenUnlocks] fetch error:', err); }
    };
    load();
    const iv = setInterval(load, 300_000);
    return () => { mounted = false; clearInterval(iv); };
  }, [wide]);

  if (unlocks === null) return <WidgetSkeleton variant="list" rows={4} />;

  if (unlocks.length === 0) {
    return (
      <div className="text-center py-4">
        <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-2">
          <Unlock className="w-4 h-4 text-amber-400/60" />
        </div>
        <p className="text-xs text-neutral-500">No upcoming unlocks</p>
        <p className="text-[10px] text-neutral-600 mt-0.5">No vesting events in the next 7 days</p>
      </div>
    );
  }

  return (
    <div>
      <div className="space-y-1.5">
        {unlocks.map((u, i) => (
          <div key={`${u.coinSymbol}-${u.unlockDate}-${i}`} className="flex items-center justify-between py-1 px-1.5 -mx-1.5 rounded-md hover:bg-white/[0.04] transition-colors">
            <div className="flex items-center gap-1.5 min-w-0">
              <TokenIconSimple symbol={u.coinSymbol} size={14} />
              <span className="text-xs text-neutral-300">{u.coinSymbol}</span>
              {u.isLarge && (
                <span className="text-[8px] px-1 py-px rounded bg-red-500/20 text-red-400 font-medium">LARGE</span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[10px] text-neutral-500">{fmtDate(u.unlockDate)}</span>
              <span className="text-[10px] text-neutral-300 font-medium tabular-nums">{fmtValue(u.unlockValue)}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between mt-2">
        <Link href="/token-unlocks" className="text-[10px] text-hub-yellow hover:underline">
          View all unlocks
        </Link>
        <div className="flex items-center gap-1.5">
          {priceSource === 'static' && (
            <span className="text-[9px] px-1 py-px rounded bg-yellow-500/15 text-yellow-500/80" title="Live prices unavailable — values based on cached prices">
              est.
            </span>
          )}
          <UpdatedAgo ts={updatedAt} />
        </div>
      </div>
    </div>
  );
}
