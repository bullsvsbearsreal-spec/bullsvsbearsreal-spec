'use client';

import { useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { getCoinIcon } from '@/lib/coinIcons';
import { ExchangeLogo } from '@/components/ExchangeLogos';
import { useApi } from '@/hooks/useSWRApi';

function fp(v: number) {
  if (v >= 10000) return v.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (v >= 1) return v.toFixed(2);
  if (v >= 0.01) return v.toFixed(4);
  return v.toFixed(6);
}

interface SpreadData {
  symbol: string;
  spreadUsd: number;
  spreadPct: number;
  highExchange: string;
  highPrice: number;
  lowExchange: string;
  lowPrice: number;
  exchangeCount: number;
}

export default function SpreadEmbedPage() {
  const params = useSearchParams();
  const symbol = params.get('s') || 'BTC';

  const fetcher = useCallback(async () => {
    const res = await fetch('/api/spreads/current');
    if (!res.ok) return null;
    const json = await res.json();
    const found = json?.data?.find((d: SpreadData) => d.symbol === symbol.toUpperCase());
    return found as SpreadData | null;
  }, [symbol]);

  const { data } = useApi<SpreadData | null>({
    key: `spread-embed-${symbol}`,
    fetcher,
    refreshInterval: 10000,
  });

  if (!data) return (
    <div className="flex items-center justify-center h-screen bg-[#0a0a0f] text-neutral-500 text-sm">Loading...</div>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-[#0c0e14] border border-white/[0.08] p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={getCoinIcon(data.symbol)} alt={`${data.symbol} icon`} className="w-8 h-8 rounded-full" />
            <div>
              <h1 className="text-lg font-bold">{data.symbol} Spread</h1>
              <p className="text-[11px] text-neutral-500">{data.exchangeCount} exchanges</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold font-mono text-amber-400">${fp(data.spreadUsd)}</p>
            <p className="text-xs text-neutral-500">{data.spreadPct.toFixed(3)}%</p>
          </div>
        </div>

        {/* Exchange comparison */}
        <div className="space-y-2">
          <div className="flex items-center justify-between p-3 rounded-lg bg-green-500/5 border border-green-500/10">
            <div className="flex items-center gap-2">
              <ExchangeLogo exchange={data.highExchange} size={18} />
              <span className="text-sm text-green-400">{data.highExchange}</span>
            </div>
            <span className="font-mono text-sm text-white">${fp(data.highPrice)}</span>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-red-500/5 border border-red-500/10">
            <div className="flex items-center gap-2">
              <ExchangeLogo exchange={data.lowExchange} size={18} />
              <span className="text-sm text-red-400">{data.lowExchange}</span>
            </div>
            <span className="font-mono text-sm text-white">${fp(data.lowPrice)}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
          <span className="text-[10px] text-neutral-600">info-hub.io/spreads</span>
          <span className="text-[10px] text-neutral-600">{new Date().toLocaleTimeString()}</span>
        </div>
      </div>
    </div>
  );
}
