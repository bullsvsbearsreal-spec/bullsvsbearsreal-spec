'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { useMarketStats } from '@/hooks/useSWRApi';
import { formatNumber } from '@/lib/utils/format';

export default function TopStatsBar() {
  const { data: stats, isLoading: loading } = useMarketStats();
  const prevValues = useRef<Record<string, string>>({});
  const [flashKeys, setFlashKeys] = useState<Record<string, 'up' | 'down'>>({});

  // Detect value changes and trigger flash
  const checkFlash = useCallback((key: string, newVal: string) => {
    const prev = prevValues.current[key];
    if (prev && prev !== newVal) {
      // Parse numeric portion to determine direction
      const prevNum = parseFloat(prev.replace(/[^0-9.-]/g, ''));
      const newNum = parseFloat(newVal.replace(/[^0-9.-]/g, ''));
      if (!isNaN(prevNum) && !isNaN(newNum) && prevNum !== newNum) {
        setFlashKeys(f => ({ ...f, [key]: newNum > prevNum ? 'up' : 'down' }));
        setTimeout(() => setFlashKeys(f => {
          const next = { ...f };
          delete next[key];
          return next;
        }), 700);
      }
    }
    prevValues.current[key] = newVal;
  }, []);

  useEffect(() => {
    if (!stats) return;
    checkFlash('vol', formatNumber(stats.totalVolume24h));
    checkFlash('oi', formatNumber(stats.totalOpenInterest));
    checkFlash('dom', `${stats.btcDominance?.toFixed(1) || '54.2'}%`);
    checkFlash('ls', `${stats.btcLongShort.longRatio.toFixed(1)}/${stats.btcLongShort.shortRatio.toFixed(1)}`);
  }, [stats, checkFlash]);

  if (loading || !stats) {
    return (
      <div className="sticky top-[49px] z-40 border-b border-white/[0.04] bg-hub-dark/95 backdrop-blur-md">
        <div className="max-w-[1400px] mx-auto px-4 py-2">
          <div className="flex items-center gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-2 animate-pulse">
                <div className="h-4 w-14 bg-white/[0.06] rounded" />
                <div className="h-4 w-20 bg-white/[0.06] rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const isLongDominant = stats.btcLongShort.longRatio > 50;

  const items = [
    { key: 'vol', label: 'Vol 24H', value: formatNumber(stats.totalVolume24h) },
    { key: 'oi', label: 'OI', value: formatNumber(stats.totalOpenInterest) },
    { key: 'dom', label: 'BTC Dom', value: `${stats.btcDominance?.toFixed(1) || '54.2'}%` },
    {
      key: 'ls',
      label: 'Long/Short',
      value: `${stats.btcLongShort.longRatio.toFixed(1)}/${stats.btcLongShort.shortRatio.toFixed(1)}`,
      color: isLongDominant ? 'text-green-400' : 'text-red-400',
    },
  ];

  return (
    <div className="sticky top-[49px] z-40 border-b border-white/[0.04] bg-hub-dark/95 backdrop-blur-md">
      <div className="max-w-[1400px] mx-auto px-4 py-1.5">
        <div className="flex items-center gap-6 sm:gap-8 overflow-x-auto text-xs top-stats-bar-items">
          {items.map((item) => {
            const flash = flashKeys[item.key];
            return (
              <div key={item.key} className="flex items-center gap-1.5 whitespace-nowrap">
                <span className="text-neutral-600 text-[10px] uppercase tracking-wide font-medium">{item.label}</span>
                <span className={`font-mono font-bold text-sm sm:text-base tracking-tight rounded px-0.5 ${
                  item.color || 'text-neutral-200'
                } ${flash === 'up' ? 'animate-flash-green' : flash === 'down' ? 'animate-flash-red' : ''}`}>
                  {item.value}
                </span>
              </div>
            );
          })}
          {/* Live heartbeat */}
          <div className="ml-auto flex items-center gap-1.5 flex-shrink-0">
            <span className="heartbeat-dot" />
            <span className="text-[9px] text-neutral-600 font-medium">LIVE</span>
          </div>
        </div>
      </div>
    </div>
  );
}
