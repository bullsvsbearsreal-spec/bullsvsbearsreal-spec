'use client';

import { useState, useEffect, useRef } from 'react';
import WidgetSkeleton from '../WidgetSkeleton';
import UpdatedAgo from '../UpdatedAgo';
import { getExchangeHexColor } from '@/lib/constants/exchange-colors';

interface LatencySample {
  exchange: string;
  ms: number;
  status: 'ok' | 'timeout' | 'error';
}

interface LatencyEntry {
  exchange: string;
  current: number;
  avg: number;
  samples: number[];
  status: 'ok' | 'degraded' | 'down';
}

// Lightweight endpoints — ping via our own API routes to avoid CORS
const EXCHANGES_TO_PING = [
  'Binance', 'Bybit', 'OKX', 'Bitget', 'Hyperliquid',
  'dYdX', 'MEXC', 'Kraken', 'KuCoin', 'HTX',
];

export default function LatencyWidget({ wide }: { wide?: boolean; widgetId?: string }) {
  const [entries, setEntries] = useState<LatencyEntry[] | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const samplesRef = useRef<Record<string, number[]>>({});

  useEffect(() => {
    let mounted = true;

    const measure = async () => {
      const results: LatencySample[] = [];

      await Promise.allSettled(
        EXCHANGES_TO_PING.map(async (exchange) => {
          const start = performance.now();
          try {
            // Ping our tickers API filtered to just this exchange — lightweight
            const res = await fetch(`/api/tickers?exchanges=${exchange}&symbols=BTC`, {
              signal: AbortSignal.timeout(5000),
            });
            const ms = Math.round(performance.now() - start);
            results.push({ exchange, ms, status: res.ok ? 'ok' : 'error' });
          } catch {
            results.push({ exchange, ms: 5000, status: 'timeout' });
          }
        }),
      );

      if (!mounted) return;

      const MAX_SAMPLES = 30;
      const newEntries: LatencyEntry[] = [];

      for (const r of results) {
        if (!samplesRef.current[r.exchange]) samplesRef.current[r.exchange] = [];
        samplesRef.current[r.exchange].push(r.ms);
        if (samplesRef.current[r.exchange].length > MAX_SAMPLES) {
          samplesRef.current[r.exchange] = samplesRef.current[r.exchange].slice(-MAX_SAMPLES);
        }

        const samples = samplesRef.current[r.exchange];
        const avg = Math.round(samples.reduce((s, v) => s + v, 0) / samples.length);

        newEntries.push({
          exchange: r.exchange,
          current: r.ms,
          avg,
          samples: [...samples],
          status: r.ms < 500 ? 'ok' : r.ms < 2000 ? 'degraded' : 'down',
        });
      }

      newEntries.sort((a, b) => a.current - b.current);
      setEntries(newEntries);
      setUpdatedAt(Date.now());
    };

    measure();
    const iv = setInterval(measure, 10_000);
    return () => { mounted = false; clearInterval(iv); };
  }, []);

  if (!entries) return <WidgetSkeleton variant="list" rows={5} />;

  const limit = wide ? 10 : 6;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-neutral-400">API Latency</span>
        <UpdatedAgo ts={updatedAt} />
      </div>

      <div className="space-y-1">
        {entries.slice(0, limit).map((e) => (
          <div key={e.exchange} className="flex items-center gap-2 py-0.5">
            {/* Status dot */}
            <div
              className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                e.status === 'ok' ? 'bg-green-500' : e.status === 'degraded' ? 'bg-amber-500 animate-pulse' : 'bg-red-500 animate-pulse'
              }`}
            />
            {/* Exchange name */}
            <span className="text-xs text-neutral-300 w-20 truncate">{e.exchange}</span>
            {/* Mini sparkline */}
            <Sparkline samples={e.samples} color={getExchangeHexColor(e.exchange)} />
            {/* Current ms */}
            <span
              className={`text-[10px] font-mono w-12 text-right ${
                e.current < 300 ? 'text-green-400' : e.current < 1000 ? 'text-hub-yellow' : 'text-red-400'
              }`}
            >
              {e.current}ms
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Sparkline({ samples, color, width = 60, height = 14 }: {
  samples: number[];
  color: string;
  width?: number;
  height?: number;
}) {
  if (samples.length < 2) return <div style={{ width, height }} />;

  const maxMs = Math.max(...samples, 500);
  const points = samples
    .map((ms, i) => {
      const x = (i / (samples.length - 1)) * width;
      const y = height - (Math.min(ms, maxMs) / maxMs) * height;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg width={width} height={height} className="flex-shrink-0">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        opacity={0.7}
      />
    </svg>
  );
}
