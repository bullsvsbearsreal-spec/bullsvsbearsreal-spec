'use client';

/**
 * Admin panel — Invites tab. Surfaces /api/admin/invites: total
 * referred, verified, distinct referrers, last-7d activity, top 10.
 */

import { useEffect, useState } from 'react';
import { Gift, TrendingUp, Users, Trophy, RefreshCw } from 'lucide-react';

interface TopReferrer {
  codePrefix: string;
  signups: number;
  verified: number;
}

interface InviteAnalytics {
  generatedAt: string;
  totalReferred: number;
  totalVerified: number;
  distinctReferrers: number;
  verifiedLast7d: number;
  topReferrers: TopReferrer[];
}

function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'white',
}: {
  label: string;
  value: string;
  hint?: string;
  icon: typeof Gift;
  tone?: 'white' | 'emerald' | 'amber';
}) {
  const toneClasses =
    tone === 'emerald' ? 'text-emerald-300'
    : tone === 'amber' ? 'text-amber-300'
    : 'text-white';
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium inline-flex items-center gap-1.5 mb-1">
        <Icon className="w-3 h-3" />
        {label}
      </div>
      <div className={`font-mono tabular-nums text-2xl font-bold ${toneClasses}`}>{value}</div>
      {hint && <div className="text-[10px] text-neutral-600 mt-1 font-mono">{hint}</div>}
    </div>
  );
}

export default function InvitesTab() {
  const [data, setData] = useState<InviteAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/invites');
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error || 'Failed to load invite analytics.');
      } else {
        setData(json);
      }
    } catch {
      setError('Network error — could not reach the server.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl border border-white/[0.06] bg-white/[0.02] animate-pulse" />
          ))}
        </div>
        <div className="h-80 rounded-xl border border-white/[0.06] bg-white/[0.02] animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-400/30 bg-red-500/5 px-3 py-2 text-xs text-red-300 flex items-center gap-2">
          <span>{error}</span>
          <button onClick={() => load(true)} className="ml-auto text-red-300 hover:text-red-200 underline">retry</button>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile
          label="Total referred"
          value={data ? data.totalReferred.toLocaleString() : '—'}
          hint="signups via any ?ref link"
          icon={Users}
        />
        <StatTile
          label="Verified"
          value={data ? data.totalVerified.toLocaleString() : '—'}
          hint={data && data.totalReferred > 0
            ? `${Math.round((data.totalVerified / data.totalReferred) * 100)}% rate`
            : ''}
          icon={TrendingUp}
          tone="emerald"
        />
        <StatTile
          label="Distinct referrers"
          value={data ? data.distinctReferrers.toLocaleString() : '—'}
          hint="unique inviters with 1+ signup"
          icon={Gift}
        />
        <StatTile
          label="Last 7d verified"
          value={data ? data.verifiedLast7d.toLocaleString() : '—'}
          hint="growth rate proxy"
          icon={TrendingUp}
          tone="amber"
        />
      </div>

      {/* Top referrers */}
      <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        <header className="flex items-center justify-between px-4 py-3 border-b border-white/[0.04]">
          <div className="inline-flex items-center gap-2">
            <Trophy className="w-3.5 h-3.5 text-amber-300" />
            <h3 className="text-sm font-bold text-white">Top 10 referrers</h3>
            <span className="text-[10px] text-neutral-500 font-mono uppercase tracking-wider">
              by verified
            </span>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1 text-[11px] text-neutral-500 hover:text-white disabled:opacity-40"
          >
            <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} /> refresh
          </button>
        </header>

        {data && data.topReferrers.length === 0 && (
          <div className="px-4 py-8 text-center text-xs text-neutral-500">
            No referrals yet. Once users start sharing /invite links, the top 10 will populate here.
          </div>
        )}

        {data && data.topReferrers.length > 0 && (
          <div>
            <div className="grid grid-cols-[40px_1fr_80px_80px] gap-2 px-4 py-2 text-[10px] uppercase tracking-wider text-neutral-500 font-bold border-b border-white/[0.04]">
              <div>#</div>
              <div>Code</div>
              <div className="text-right">Sign-ups</div>
              <div className="text-right">Verified</div>
            </div>
            {data.topReferrers.map((r, i) => (
              <div
                key={r.codePrefix}
                className="grid grid-cols-[40px_1fr_80px_80px] gap-2 items-center px-4 py-2 border-b border-white/[0.04] last:border-b-0 hover:bg-white/[0.02] transition-colors"
              >
                <div className="text-xs text-neutral-500 font-mono tabular-nums">{i + 1}</div>
                <div className="font-mono text-[12px] text-neutral-300">{r.codePrefix}<span className="text-neutral-600">***</span></div>
                <div className="text-right font-mono tabular-nums text-[12px] text-white">{r.signups.toLocaleString()}</div>
                <div className="text-right font-mono tabular-nums text-[12px] text-emerald-300">{r.verified.toLocaleString()}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      {data?.generatedAt && (
        <p className="text-[10px] text-neutral-600 font-mono text-right">
          Generated {new Date(data.generatedAt).toLocaleString()}
        </p>
      )}
    </div>
  );
}
