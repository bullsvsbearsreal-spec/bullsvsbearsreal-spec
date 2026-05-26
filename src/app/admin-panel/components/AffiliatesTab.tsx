'use client';

/**
 * Admin Panel · Affiliates tab.
 *
 * Surfaces the full affiliate program at a glance. Five sections:
 *
 *   1. Headline counters — total affiliates, signups, conversions, $ pending
 *   2. Top 10 affiliates by conversions ($) — who's actually earning
 *   3. Top 10 affiliates by signups — who's driving volume (may not have
 *      converted yet, especially pre-paid-launch)
 *   4. Recent activity feed — last 30 events across the program
 *   5. Quick actions placeholder (payout export, mark paid, etc. — TBD)
 *
 * Data source: /api/admin/affiliates (read-only). Polls every 60s.
 */

import { useEffect, useState } from 'react';
import { Users, Loader2, DollarSign, TrendingUp, Sparkles } from 'lucide-react';

interface AffiliateRow {
  affiliateUserId: string;
  affiliateEmail: string | null;
  affiliateName: string | null;
  referralCode: string | null;
  signups: number;
  conversions: number;
  totalCommissionUsd: number;
  paidOutUsd: number;
  pendingUsd: number;
}

interface RecentEvent {
  id: number;
  affiliateUserId: string;
  affiliateEmail: string | null;
  eventType: string;
  amountUsd: number | null;
  commissionUsd: number | null;
  createdAt: string;
}

interface Overview {
  totalAffiliates: number;
  totalReferredSignups: number;
  totalConversions: number;
  totalCommissionUsd: number;
  totalPaidOutUsd: number;
  totalPendingUsd: number;
  topByConversions: AffiliateRow[];
  topBySignups: AffiliateRow[];
  recentEvents: RecentEvent[];
}

export default function AffiliatesTab() {
  const [data, setData] = useState<Overview | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/admin/affiliates', { cache: 'no-store' });
        if (!res.ok) {
          setErr(`HTTP ${res.status}`);
          return;
        }
        const j = (await res.json()) as Overview;
        if (!cancelled) setData(j);
      } catch (e) {
        if (!cancelled) setErr('Network error');
      }
    };
    load();
    const id = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  if (err) {
    return (
      <div className="rounded-xl border border-rose-400/30 bg-rose-500/[0.04] p-4">
        <p className="text-[13px] text-rose-300">Failed to load: {err}</p>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="py-16 text-center text-neutral-500 text-sm">
        <Loader2 className="w-4 h-4 inline mr-2 animate-spin" />Loading affiliate stats…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Headline counters ── */}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <CounterCard label="Affiliates" value={data.totalAffiliates.toLocaleString()} hint="With ≥1 event" icon={<Users className="w-3.5 h-3.5" />} />
        <CounterCard label="Signups (referred)" value={data.totalReferredSignups.toLocaleString()} hint="users.referred_by_user_id set" icon={<TrendingUp className="w-3.5 h-3.5" />} />
        <CounterCard label="Conversions" value={data.totalConversions.toLocaleString()} hint="First-paid-month events" icon={<Sparkles className="w-3.5 h-3.5" />} />
        <CounterCard label="Total commission" value={`$${data.totalCommissionUsd.toFixed(2)}`} hint="Earned across program" icon={<DollarSign className="w-3.5 h-3.5" />} />
        <CounterCard label="Paid out" value={`$${data.totalPaidOutUsd.toFixed(2)}`} hint="USDT payouts sent" />
        <CounterCard label="Pending" value={`$${data.totalPendingUsd.toFixed(2)}`} hint="Owed to affiliates" accent />
      </section>

      {/* ── Top by commission ── */}
      <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
          <h3 className="text-[13px] font-bold uppercase tracking-wider text-white">Top by commission ($)</h3>
          <span className="text-[10px] text-neutral-500">{data.topByConversions.length} of program</span>
        </div>
        <AffiliateTable rows={data.topByConversions} metricLabel="Earned" />
      </section>

      {/* ── Top by signups ── */}
      <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
          <h3 className="text-[13px] font-bold uppercase tracking-wider text-white">Top by signups</h3>
          <span className="text-[10px] text-neutral-500">Volume drivers · may have $0 if pre-paid-launch</span>
        </div>
        <AffiliateTable rows={data.topBySignups} metricLabel="Signups" sortByCol="signups" />
      </section>

      {/* ── Recent activity ── */}
      <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        <div className="px-4 py-3 border-b border-white/[0.06]">
          <h3 className="text-[13px] font-bold uppercase tracking-wider text-white">Recent activity</h3>
        </div>
        {data.recentEvents.length === 0 ? (
          <div className="px-4 py-8 text-center text-[12px] text-neutral-500">
            No referral activity yet. The first event will appear here when a user signs up via someone&apos;s link.
          </div>
        ) : (
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-neutral-500">
                <th className="px-4 py-2 font-semibold">When</th>
                <th className="px-4 py-2 font-semibold">Event</th>
                <th className="px-4 py-2 font-semibold">Affiliate</th>
                <th className="px-4 py-2 font-semibold text-right">Amount</th>
                <th className="px-4 py-2 font-semibold text-right">Commission</th>
              </tr>
            </thead>
            <tbody>
              {data.recentEvents.map((e) => (
                <tr key={e.id} className="border-t border-white/[0.04]">
                  <td className="px-4 py-2 text-neutral-400">
                    {new Date(e.createdAt).toLocaleDateString()} ·{' '}
                    {new Date(e.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-4 py-2"><EventChip type={e.eventType} /></td>
                  <td className="px-4 py-2 text-neutral-300 truncate max-w-[240px]">
                    {e.affiliateEmail ?? e.affiliateUserId.slice(0, 8)}
                  </td>
                  <td className="px-4 py-2 text-right text-neutral-300 font-mono">
                    {e.amountUsd != null ? `$${e.amountUsd.toFixed(2)}` : '—'}
                  </td>
                  <td className="px-4 py-2 text-right text-emerald-300 font-mono">
                    {e.commissionUsd != null ? `$${e.commissionUsd.toFixed(2)}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* ── Operator notes ── */}
      <section className="rounded-xl border border-amber-400/20 bg-amber-500/[0.03] p-4">
        <h3 className="text-[12px] font-bold uppercase tracking-wider text-amber-300 mb-2">Operator</h3>
        <ul className="text-[12px] text-neutral-300 space-y-1.5 leading-relaxed">
          <li>• Pending $ accrue as referral_events rows of type=conversion arrive (auto-logged on first-paid-month).</li>
          <li>• Payouts: manual until automation lands. Workflow: export pending rows → send USDT → INSERT a referral_events row of type=payout with the tx_hash.</li>
          <li>• Pre-paid-launch, conversions = 0 by design. Signups + clicks still accumulate so attribution is preserved.</li>
        </ul>
      </section>
    </div>
  );
}

/* ─── Sub-components ─────────────────────────────────────────────── */

function CounterCard({ label, value, hint, icon, accent }: {
  label: string;
  value: string;
  hint?: string;
  icon?: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-4 ${accent ? 'border-emerald-400/30 bg-emerald-500/[0.04]' : 'border-white/[0.06] bg-white/[0.02]'}`}>
      <div className={`flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold mb-1 ${accent ? 'text-emerald-300' : 'text-neutral-500'}`}>
        {icon}{label}
      </div>
      <p className={`text-lg font-bold ${accent ? 'text-emerald-200' : 'text-white'}`}>{value}</p>
      {hint && <p className="text-[10px] text-neutral-500 mt-0.5">{hint}</p>}
    </div>
  );
}

function AffiliateTable({ rows, metricLabel, sortByCol }: {
  rows: AffiliateRow[];
  metricLabel: string;
  sortByCol?: 'commission' | 'signups';
}) {
  if (rows.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-[12px] text-neutral-500">
        No affiliates here yet.
      </div>
    );
  }
  return (
    <table className="w-full text-[12px]">
      <thead>
        <tr className="text-left text-[10px] uppercase tracking-wider text-neutral-500">
          <th className="px-4 py-2 font-semibold">#</th>
          <th className="px-4 py-2 font-semibold">Affiliate</th>
          <th className="px-4 py-2 font-semibold">Code</th>
          <th className="px-4 py-2 font-semibold text-right">Signups</th>
          <th className="px-4 py-2 font-semibold text-right">Conv.</th>
          <th className="px-4 py-2 font-semibold text-right">Earned</th>
          <th className="px-4 py-2 font-semibold text-right">Pending</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.affiliateUserId} className="border-t border-white/[0.04]">
            <td className="px-4 py-2 text-neutral-500 font-mono">{i + 1}</td>
            <td className="px-4 py-2 text-neutral-200 truncate max-w-[240px]">
              {r.affiliateName ?? r.affiliateEmail ?? r.affiliateUserId.slice(0, 8)}
            </td>
            <td className="px-4 py-2 font-mono text-[11px] text-sky-300">
              {r.referralCode ?? '—'}
            </td>
            <td className="px-4 py-2 text-right text-neutral-300 font-mono">{r.signups.toLocaleString()}</td>
            <td className="px-4 py-2 text-right text-emerald-300 font-mono">{r.conversions.toLocaleString()}</td>
            <td className="px-4 py-2 text-right text-emerald-300 font-mono">${r.totalCommissionUsd.toFixed(2)}</td>
            <td className="px-4 py-2 text-right text-amber-300 font-mono">${r.pendingUsd.toFixed(2)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function EventChip({ type }: { type: string }) {
  const styles: Record<string, string> = {
    click:      'bg-white/[0.06] text-neutral-300 border-white/[0.1]',
    signup:     'bg-sky-500/15 text-sky-300 border-sky-400/30',
    conversion: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30',
    payout:     'bg-amber-500/15 text-amber-300 border-amber-400/30',
  };
  const cls = styles[type] ?? 'bg-white/[0.06] text-neutral-300 border-white/[0.1]';
  return (
    <span className={`inline-flex items-center text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border ${cls}`}>
      {type}
    </span>
  );
}
