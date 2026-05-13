'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { useMarketStats } from '@/hooks/useSWRApi';
import { formatNumber } from '@/lib/utils/format';
import { useAggregatorHealth } from '@/hooks/useAggregatorHealth';

export default function TopStatsBar() {
  const { data: stats, isLoading: loading } = useMarketStats();
  // Real aggregator status — the previous "streaming" green pulsing dot
  // was rendered unconditionally on this bar; now it reflects whether
  // the aggregator is actually connected.
  const { status: aggStatus } = useAggregatorHealth();
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
    checkFlash('dom', stats.btcDominance != null && Number.isFinite(stats.btcDominance)
      ? `${stats.btcDominance.toFixed(1)}%`
      : '—');
    if (stats.btcLongShort) checkFlash('ls', `${stats.btcLongShort.longRatio.toFixed(1)}/${stats.btcLongShort.shortRatio.toFixed(1)}`);
  }, [stats, checkFlash]);

  if (loading || !stats) {
    return (
      <div className="sticky top-[49px] z-40 border-b border-white/[0.04] bg-hub-dark/95 backdrop-blur-md">
        <div className="max-w-[1400px] mx-auto px-4 py-2">
          <div className="flex items-center gap-6 overflow-x-auto scrollbar-hide top-stats-bar-items">
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

  const longRatio = stats.btcLongShort?.longRatio;
  const shortRatio = stats.btcLongShort?.shortRatio;
  const isLongDominant = longRatio != null ? longRatio > 50 : true;

  const items = [
    { key: 'vol', label: 'Vol 24H', value: formatNumber(stats.totalVolume24h) },
    { key: 'oi', label: 'OI', value: formatNumber(stats.totalOpenInterest) },
    { key: 'dom', label: 'BTC Dom', value: stats.btcDominance != null && Number.isFinite(stats.btcDominance)
      ? `${stats.btcDominance.toFixed(1)}%`
      : '—' },
  ];

  const lsFlash = flashKeys['ls'];

  return (
    <div className="sticky top-[49px] z-40 border-b border-white/[0.04] bg-hub-dark/95 backdrop-blur-md">
      <div className="max-w-[1400px] mx-auto px-4 py-1.5">
        <div className="flex items-center gap-6 sm:gap-8 overflow-x-auto text-xs top-stats-bar-items">
          {items.map((item) => {
            const flash = flashKeys[item.key];
            return (
              <div key={item.key} className="flex items-center gap-1.5 whitespace-nowrap">
                <span className="text-neutral-600 text-[10px] uppercase tracking-wide font-medium">{item.label}</span>
                <span className={`font-mono font-bold text-sm sm:text-base tracking-tight rounded px-0.5 text-neutral-200 ${
                  flash === 'up' ? 'animate-flash-green' : flash === 'down' ? 'animate-flash-red' : ''
                }`}>
                  {item.value}
                </span>
              </div>
            );
          })}

          {/* Long/Short — split colors so each side reads independently */}
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="text-neutral-600 text-[10px] uppercase tracking-wide font-medium">Long/Short</span>
            {longRatio != null && shortRatio != null ? (
              <span
                className={`font-mono font-bold text-sm sm:text-base tracking-tight rounded px-0.5 ${
                  lsFlash === 'up' ? 'animate-flash-green' : lsFlash === 'down' ? 'animate-flash-red' : ''
                }`}
                aria-label={`Longs ${longRatio.toFixed(1)} percent, shorts ${shortRatio.toFixed(1)} percent`}
              >
                <span className={isLongDominant ? 'text-green-400' : 'text-green-400/60'}>
                  {longRatio.toFixed(1)}
                </span>
                <span className="text-neutral-600 mx-0.5">/</span>
                <span className={isLongDominant ? 'text-red-400/60' : 'text-red-400'}>
                  {shortRatio.toFixed(1)}
                </span>
              </span>
            ) : (
              <span className="font-mono font-bold text-sm sm:text-base tracking-tight text-neutral-500">–/–</span>
            )}
          </div>

          {/* Live heartbeat — now reflects real aggregator status.
              Was previously a permanently-green pulsing dot labeled
              "streaming" rendered unconditionally. */}
          <div className="ml-auto flex items-center gap-1.5 flex-shrink-0">
            <span
              className={
                aggStatus === 'streaming' ? 'heartbeat-dot' :
                aggStatus === 'degraded'  ? 'heartbeat-dot heartbeat-dot--degraded' :
                aggStatus === 'offline'   ? 'heartbeat-dot heartbeat-dot--offline' :
                'heartbeat-dot heartbeat-dot--pending'
              }
            />
            <span className="text-[9px] text-neutral-600 font-medium tracking-wide">
              {aggStatus === 'streaming' ? 'streaming'
                : aggStatus === 'degraded' ? 'degraded'
                : aggStatus === 'offline' ? 'offline'
                : 'connecting'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
