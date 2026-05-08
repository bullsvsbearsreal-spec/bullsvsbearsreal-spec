'use client';

/**
 * BounceStatsWidget — Bounce.tech rekt-leaderboard stats summary.
 *
 * Compact view of the top liquidated wallets on Hyperliquid as tracked by
 * bounce.tech. Shows ecosystem totals + top 3 rekt wallets. Clicks deep-link
 * into /bounce/<addr> for the full per-wallet profile.
 *
 * Data: GET /api/rekt-leaderboard?limit=10&sort=notional (5 min cache)
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Skull, ExternalLink } from 'lucide-react';
import WidgetSkeleton from '../WidgetSkeleton';
import UpdatedAgo from '../UpdatedAgo';

interface RektRow {
  rank: number;
  address: string;
  totalNotional: number;
  count: number;
  score: number;
}
interface RektResponse {
  data: RektRow[];
  summary: {
    totalRekt: number;
    totalWallets: number;
    totalLiquidations: number;
    biggestLoser: string | null;
    biggestLoserNotional: number;
    biggestScore: number;
  };
  meta: { timestamp: number };
}

function shortAddr(a: string): string {
  if (!a) return '—';
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function fmtCompact(n?: number): string {
  if (n == null || !Number.isFinite(n)) return '—';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

export default function BounceStatsWidget({ wide }: { wide?: boolean }) {
  const [data, setData] = useState<RektResponse | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await fetch('/api/rekt-leaderboard?limit=10&sort=notional', {
          signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) return;
        const json = await res.json();
        if (mounted) {
          setData(json);
          setUpdatedAt(Date.now());
        }
      } catch (err) { console.error('[BounceStats] error:', err); }
    };
    load();
    const iv = setInterval(load, 5 * 60_000);
    return () => { mounted = false; clearInterval(iv); };
  }, []);

  if (!data) return <WidgetSkeleton variant="list" />;

  const top = data.data.slice(0, wide ? 5 : 3);

  return (
    <div className="space-y-3">
      {/* Top stat row — 2 metrics, big numbers */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-rose-500/[0.06] border border-rose-400/20 px-2.5 py-2">
          <div className="text-[9px] uppercase tracking-wider text-neutral-500 font-medium">Total rekt</div>
          <div className="text-lg font-bold font-mono tabular-nums text-rose-400">
            {fmtCompact(data.summary.totalRekt)}
          </div>
          <div className="text-[9px] text-neutral-600 font-mono mt-0.5">top {data.data.length} wallets</div>
        </div>
        <div className="rounded-lg bg-orange-500/[0.06] border border-orange-400/20 px-2.5 py-2">
          <div className="text-[9px] uppercase tracking-wider text-neutral-500 font-medium">Liq events</div>
          <div className="text-lg font-bold font-mono tabular-nums text-orange-400">
            {data.summary.totalLiquidations.toLocaleString()}
          </div>
          <div className="text-[9px] text-neutral-600 font-mono mt-0.5">total events</div>
        </div>
      </div>

      {/* Top rekt wallets */}
      <div className="space-y-1">
        <div className="flex items-baseline justify-between mb-1 px-0.5">
          <span className="text-[9px] uppercase tracking-wider text-neutral-500 font-bold flex items-center gap-1">
            <Skull className="w-2.5 h-2.5 text-rose-400" />
            Most rekt wallets
          </span>
          <Link href="/bounce" className="text-[9px] text-neutral-500 hover:text-rose-400 inline-flex items-center gap-0.5">
            Full <ExternalLink className="w-2 h-2" />
          </Link>
        </div>
        {top.map((r, i) => {
          const rankColor =
            i === 0 ? 'text-rose-400' :
            i === 1 ? 'text-orange-400' :
            i === 2 ? 'text-amber-400' :
            'text-neutral-500';
          return (
            <Link
              key={r.address}
              href={`/bounce/${r.address}`}
              className="grid grid-cols-[24px_1fr_auto] gap-2 items-center px-2 py-1.5 rounded hover:bg-white/[0.03] transition-colors group text-xs"
            >
              <span className={`font-mono font-bold ${rankColor}`}>#{r.rank}</span>
              <span className="font-mono text-neutral-300 group-hover:text-white truncate text-[11px]">
                {shortAddr(r.address)}
              </span>
              <span className="font-mono tabular-nums text-rose-400 font-semibold text-[11px]">
                {fmtCompact(r.totalNotional)}
              </span>
            </Link>
          );
        })}
      </div>

      <div className="flex justify-between items-center pt-1 border-t border-white/[0.04]">
        <span className="text-[9px] text-neutral-600 font-mono">
          via <span className="text-rose-400/60">bounce.tech</span>
        </span>
        <UpdatedAgo ts={updatedAt} />
      </div>
    </div>
  );
}
