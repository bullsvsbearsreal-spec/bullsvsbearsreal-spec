'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { TokenIconSimple } from '@/components/TokenIcon';
import { useUserData } from '../useUserData';
import WidgetSkeleton from '../WidgetSkeleton';

interface AlertRow {
  id: string;
  symbol: string;
  metric: string;
  operator: string;
  value: number;
  currentPrice: number;
  proximity: number; // 0-1, how close to trigger (1 = triggered)
}

export default function AlertsWidget({ wide }: { wide?: boolean }) {
  const userData = useUserData();
  const [rows, setRows] = useState<AlertRow[]>([]);
  const mountedRef = useRef(true);

  const alerts = userData?.alerts ?? [];
  // Stable reference: only recompute when alerts content actually changes
  const alertsKey = useMemo(() => JSON.stringify(alerts), [alerts]);

  useEffect(() => {
    mountedRef.current = true;
    if (alerts.length === 0) { setRows([]); return; }

    const load = async () => {
      try {
        const res = await fetch('/api/tickers');
        if (!res.ok) return;
        const json = await res.json();
        const data = Array.isArray(json) ? json : json?.data || [];
        if (!Array.isArray(data) || !mountedRef.current) return;

        const priceMap = new Map<string, number>();
        for (const t of data) {
          const sym = (t.symbol || '').replace(/USDT$/, '');
          if (!priceMap.has(sym)) {
            priceMap.set(sym, t.price || t.lastPrice || 0);
          }
        }

        const mapped: AlertRow[] = alerts.map((a: any, i: number) => {
          const price = priceMap.get(a.symbol) || 0;
          const target = Number(a.value) || 0;
          let proximity = 0;
          if (a.metric === 'price' && price > 0 && target > 0) {
            if (a.operator === 'gt') {
              // Price needs to go UP to target
              proximity = price >= target ? 1 : price / target;
            } else {
              // Price needs to go DOWN to target
              proximity = price <= target ? 1 : target / price;
            }
          }
          return {
            id: a.id || String(i),
            symbol: a.symbol,
            metric: a.metric,
            operator: a.operator,
            value: target,
            currentPrice: price,
            proximity,
          };
        });

        // Sort by proximity descending (closest to triggering first)
        mapped.sort((a, b) => b.proximity - a.proximity);

        if (mountedRef.current) setRows(mapped);
      } catch (err) { console.error('[Alerts] fetch error:', err); }
    };

    load();
    const iv = setInterval(load, 30_000);
    return () => { mountedRef.current = false; clearInterval(iv); };
  }, [alertsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  if (userData === null) return <WidgetSkeleton variant="list" rows={4} />;

  if (alerts.length === 0) {
    return (
      <div className="text-center py-3">
        <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-2">
          <Bell className="w-4 h-4 text-amber-400/60" />
        </div>
        <p className="text-xs text-neutral-500 mb-0.5">Never miss a move</p>
        <p className="text-[10px] text-neutral-600 mb-2">Set price alerts and get notified when targets hit</p>
        <Link href="/alerts" className="text-[10px] text-hub-yellow hover:underline font-medium">+ Create alert</Link>
      </div>
    );
  }

  const limit = wide ? 6 : 4;
  const visible = rows.slice(0, limit);

  const fmtPrice = (p: number) => {
    if (p >= 1000) return '$' + p.toLocaleString(undefined, { maximumFractionDigits: 0 });
    if (p >= 1) return '$' + p.toFixed(2);
    if (p > 0) return '$' + p.toPrecision(3);
    return '—';
  };

  return (
    <div>
      <p className="text-xs text-neutral-500 mb-2">{alerts.length} active</p>
      <div className="space-y-2">
        {visible.map((a) => {
          const close = a.proximity >= 0.95;
          const barColor = close ? 'bg-hub-yellow' : a.proximity >= 0.8 ? 'bg-green-500/60' : 'bg-white/10';
          return (
            <div key={a.id}>
              <div className="flex items-center justify-between mb-0.5">
                <div className="flex items-center gap-1">
                  <TokenIconSimple symbol={a.symbol} size={12} />
                  <span className="text-[10px] text-neutral-400">{a.symbol}</span>
                  <span className="text-[10px] text-neutral-600">{a.operator === 'gt' ? '>' : '<'}</span>
                  <span className="text-[10px] text-neutral-300">{fmtPrice(a.value)}</span>
                </div>
                {a.currentPrice > 0 && (
                  <span className="text-[10px] text-neutral-500 tabular-nums">
                    now {fmtPrice(a.currentPrice)}
                  </span>
                )}
              </div>
              {/* Proximity bar */}
              <div className="h-1 rounded-full bg-white/[0.04] overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${barColor}`}
                  style={{ width: `${Math.min(a.proximity * 100, 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      {alerts.length > limit && (
        <Link href="/alerts" className="block text-center mt-2 text-[10px] text-hub-yellow hover:underline">
          View all {alerts.length} alerts
        </Link>
      )}
    </div>
  );
}
