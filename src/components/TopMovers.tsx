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

export default function TopMovers() {
  const [gainers, setGainers] = useState<CMCMover[]>([]);
  const [losers, setLosers] = useState<CMCMover[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'gainers' | 'losers'>('gainers');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/top-movers');
        const data = await res.json();
        setGainers(data.gainers || []);
        setLosers(data.losers || []);
      } catch (error) {
        console.error('Failed to fetch top movers:', error);
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
              view === 'gainers' ? 'bg-green-500 text-white' : 'text-neutral-500 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            Gainers
          </button>
          <button
            onClick={() => setView('losers')}
            className={`px-2.5 py-1 text-[10px] font-medium transition-colors ${
              view === 'losers' ? 'bg-red-500 text-white' : 'text-neutral-500 hover:text-white hover:bg-white/[0.04]'
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
        <div className="space-y-1">
          {items.slice(0, 5).map((item, index) => (
            <div
              key={item.symbol}
              className="data-row-premium flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <span className="text-neutral-700 text-[10px] font-mono w-3">{index + 1}</span>
                <TokenIconSimple symbol={item.symbol} size={20} cmcId={item.cmcId} />
                <div className="flex flex-col">
                  <span className="text-white font-medium text-xs">{item.symbol}</span>
                  <span className="text-neutral-600 text-[9px] leading-none">{formatPrice(item.price)}</span>
                </div>
              </div>
              <div className={`h-5 rounded-md px-1.5 flex items-center ${
                item.change24h >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'
              }`}>
                <span className={`font-mono font-bold text-[11px] tabular-nums ${
                  item.change24h >= 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {item.change24h >= 0 ? '+' : ''}
                  {item.change24h.toFixed(2)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
