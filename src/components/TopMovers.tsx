'use client';

import { useState, useEffect } from 'react';
import { TokenIconSimple } from './TokenIcon';
import { formatPrice } from '@/lib/utils/format';
import { Rocket } from 'lucide-react';

interface CMCMover {
  symbol: string;
  name: string;
  slug: string;
  cmcId: number;
  price: number;
  change24h: number;
  marketCap: number;
  volume24h: number;
}

/** Get trader slang tooltip for extreme moves */
function getTraderSlang(change: number, view: 'gainers' | 'losers'): string | null {
  const abs = Math.abs(change);
  if (abs < 15) return null;
  if (view === 'gainers') {
    if (abs >= 50) return 'Absolutely sending it';
    if (abs >= 30) return 'Shorts getting liquidated';
    return 'Degens pumping hard';
  } else {
    if (abs >= 50) return 'Total capitulation';
    if (abs >= 30) return 'Getting absolutely rekt';
    return 'Longs in shambles';
  }
}

export default function TopMovers() {
  const [gainers, setGainers] = useState<CMCMover[]>([]);
  const [losers, setLosers] = useState<CMCMover[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'gainers' | 'losers'>('gainers');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/top-movers');
        if (!res.ok) throw new Error(`Top movers API ${res.status}`);
        const data = await res.json();
        setGainers(data.gainers || []);
        setLosers(data.losers || []);
      } catch (error) {
        console.warn('Failed to fetch top movers:', error instanceof Error ? error.message : error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  const items = view === 'gainers' ? gainers : losers;

  return (
    <div className="card-premium p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-hub-yellow/10 flex items-center justify-center">
            <Rocket className="w-3 h-3 text-hub-yellow" />
          </div>
          <h3 className="text-white font-semibold text-sm">Top Movers</h3>
        </div>
        <div className="flex rounded-lg overflow-hidden bg-white/[0.04] border border-white/[0.06]">
          <button
            onClick={() => setView('gainers')}
            className={`px-2.5 py-1 text-[10px] font-medium transition-colors ${
              view === 'gainers' ? 'bg-green-500 text-hub-black font-semibold' : 'text-neutral-500 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            Gainers
          </button>
          <button
            onClick={() => setView('losers')}
            className={`px-2.5 py-1 text-[10px] font-medium transition-colors ${
              view === 'losers' ? 'bg-red-500 text-hub-black font-semibold' : 'text-neutral-500 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            Losers
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-1.5">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="animate-pulse h-10 bg-white/[0.03] rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="ranked-list space-y-0.5">
          {items.slice(0, 5).map((item, index) => {
            const isExtreme = Math.abs(item.change24h) >= 15;
            const slang = getTraderSlang(item.change24h, view);
            return (
              <div
                key={item.symbol}
                className={`rank-row ${index === 0 ? '' : ''}`}
              >
                <span className={`rank-number ${index < 3 ? 'rank-number-top' : ''}`}>
                  {index + 1}
                </span>
                <TokenIconSimple symbol={item.symbol} size={20} cmcId={item.cmcId} />
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="text-white font-medium text-xs">{item.symbol}</span>
                  <span className="text-neutral-600 text-[9px] leading-none">{formatPrice(item.price)}</span>
                </div>
                <div className="relative has-tooltip">
                  <span className={`delta-badge ${
                    isExtreme
                      ? (item.change24h >= 0 ? 'delta-badge-extreme-up pip-up' : 'delta-badge-extreme-down pip-down')
                      : (item.change24h >= 0 ? 'delta-badge-up pip-up' : 'delta-badge-down pip-down')
                  }`}>
                    {item.change24h >= 0 ? '+' : ''}
                    {item.change24h.toFixed(2)}%
                  </span>
                  {slang && (
                    <span className="trader-tooltip">
                      <span className="tooltip-slang">{slang}</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
