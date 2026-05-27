'use client';

/**
 * Revenue tab — projected MRR/ARR + affiliate revenue + commission owed.
 *
 * "Projected" because most paid tiers are comped during launch — the
 * numbers show the upside ceiling assuming every paid-tier user pays.
 * Once NowPayments wires up actual webhook events these flip to real.
 */

import { useEffect, useState } from 'react';
import { DollarSign, TrendingUp, Gift, Users, Calendar, AlertTriangle } from 'lucide-react';
import { Card, SectionHead, SkeletonBlock, fmtNumber, TIER_COLORS } from '../components/primitives';

interface RevenueResp {
  projected: {
    mrrUsd: number;
    arrUsd: number;
    payingUsers: number;
    tierBreakdown: { tier: string; count: number; mrr: number; monthlyPrice: number }[];
  };
  affiliate: {
    revenueTotalUsd: number;
    revenue30dUsd: number;
    conversionsTotal: number;
    conversions30d: number;
    payoutsTotalUsd: number;
    payoutsCount: number;
    commissionOwedUsd: number;
  };
  recentConversions: {
    timestamp: string;
    amountUsd: number;
    commissionUsd: number;
    email: string | null;
  }[];
  tierChanges30d: number;
  note?: string;
}

function fmtUsd(n: number): string {
  if (!Number.isFinite(n)) return '—';
  if (n === 0) return '$0';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 10_000)    return `$${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return 'just now';
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function RevenueTab() {
  const [data, setData] = useState<RevenueResp | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/revenue')
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(d => { if (d?.error) setError(d.error); else setData(d); })
      .catch(e => setError(e.message ?? 'Network error'));
  }, []);

  return (
    <>
      {data?.note && (
        <div style={{
          background: 'rgba(125, 211, 252, 0.06)',
          border: '1px solid rgba(125, 211, 252, 0.2)',
          borderRadius: 8, padding: '8px 12px', marginBottom: 14,
          fontSize: 11, color: '#7dd3fc',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <AlertTriangle style={{ width: 13, height: 13, flexShrink: 0 }} />
          <span>{data.note}</span>
        </div>
      )}

      {error && (
        <div style={{
          background: 'rgba(244, 63, 94, 0.08)',
          border: '1px solid rgba(244, 63, 94, 0.3)',
          borderRadius: 8, padding: '8px 12px', marginBottom: 14,
          fontSize: 12, color: '#fda4af',
        }}>
          {error}
        </div>
      )}

      {/* Hero MRR/ARR */}
      <SectionHead title="Projected Revenue (paid tiers × monthly price)" icon={<DollarSign style={{ width: 13, height: 13 }} />} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 18 }}>
        <KpiTile label="Projected MRR"        value={data ? fmtUsd(data.projected.mrrUsd) : null}        accent="#34d399" />
        <KpiTile label="Projected ARR"        value={data ? fmtUsd(data.projected.arrUsd) : null}        accent="#7dd3fc" />
        <KpiTile label="Paying users"         value={data ? fmtNumber(data.projected.payingUsers) : null} accent="#fcd34d" />
        <KpiTile label="Tier changes · 30d"   value={data ? fmtNumber(data.tierChanges30d) : null}        accent="#c4b5fd" />
      </div>

      {/* Tier breakdown */}
      <SectionHead title="MRR by Tier" icon={<TrendingUp style={{ width: 13, height: 13 }} />} />
      <Card title="Paid-tier composition (projected)">
        {!data ? <SkeletonBlock h={100} /> : data.projected.tierBreakdown.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--fg-faint)', textAlign: 'center', padding: '16px 0' }}>
            No paid-tier users yet.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {data.projected.tierBreakdown.map(t => {
              const total = data.projected.mrrUsd || 1;
              const pct = (t.mrr / total) * 100;
              return (
                <div key={t.tier} style={{ display: 'grid', gridTemplateColumns: '70px 1fr 80px 80px', alignItems: 'center', gap: 12 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                    color: TIER_COLORS[t.tier] ?? '#fff',
                  }}>{t.tier}</span>
                  <div style={{ height: 8, background: 'rgba(255,255,255,0.04)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: TIER_COLORS[t.tier], transition: 'width 600ms ease-out' }} />
                  </div>
                  <span style={{ fontFamily: 'var(--font-mono)', textAlign: 'right', fontSize: 12, color: '#fff' }}>
                    {t.count} × ${t.monthlyPrice}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#fff' }}>
                    {fmtUsd(t.mrr)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Affiliate revenue */}
      <SectionHead title="Affiliate Revenue (actual, attributed)" icon={<Gift style={{ width: 13, height: 13 }} />} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 14 }}>
        <KpiTile label="Revenue total"       value={data ? fmtUsd(data.affiliate.revenueTotalUsd)   : null} accent="#34d399"
                 sub={data ? `${fmtNumber(data.affiliate.conversionsTotal)} conversions` : null} />
        <KpiTile label="Revenue · 30d"       value={data ? fmtUsd(data.affiliate.revenue30dUsd)     : null} accent="#fcd34d"
                 sub={data ? `${fmtNumber(data.affiliate.conversions30d)} new` : null} />
        <KpiTile label="Payouts sent"        value={data ? fmtUsd(data.affiliate.payoutsTotalUsd)   : null} accent="#7dd3fc"
                 sub={data ? `${fmtNumber(data.affiliate.payoutsCount)} txs` : null} />
        <KpiTile label="Commission owed"     value={data ? fmtUsd(data.affiliate.commissionOwedUsd) : null} accent={data && data.affiliate.commissionOwedUsd > 0 ? '#f43f5e' : '#9ca3af'}
                 sub={data ? '20% of conversions' : null} />
      </div>

      {/* Recent conversions */}
      <SectionHead title="Recent Conversions" icon={<Calendar style={{ width: 13, height: 13 }} />} />
      <Card title="Last 10 paid conversions">
        {!data ? <SkeletonBlock h={120} /> : data.recentConversions.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--fg-faint)', textAlign: 'center', padding: '16px 0' }}>
            No conversions recorded yet.
          </div>
        ) : (
          <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--fg-faint)' }}>
                <th style={{ textAlign: 'left', padding: '6px 0', fontWeight: 700 }}>Referred user</th>
                <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 700 }}>Amount</th>
                <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 700 }}>Commission</th>
                <th style={{ textAlign: 'right', padding: '6px 0', fontWeight: 700 }}>When</th>
              </tr>
            </thead>
            <tbody>
              {data.recentConversions.map((r, i) => (
                <tr key={`${r.timestamp}-${i}`} style={{ borderTop: '1px solid rgba(255,255,255,0.03)' }}>
                  <td style={{ padding: '8px 0', color: '#fff' }}>{r.email ?? <span style={{ color: 'var(--fg-faint)' }}>anonymous</span>}</td>
                  <td style={{ padding: '8px 8px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: '#34d399' }}>{fmtUsd(r.amountUsd)}</td>
                  <td style={{ padding: '8px 8px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: '#fcd34d' }}>{fmtUsd(r.commissionUsd)}</td>
                  <td style={{ padding: '8px 0', textAlign: 'right', color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)' }}>{fmtAgo(r.timestamp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}

function KpiTile({ label, value, sub, accent }: { label: string; value: string | null; sub?: string | null; accent: string }) {
  return (
    <div style={{
      background: 'var(--hub-darker)',
      border: '1px solid var(--hub-border-subtle)',
      borderRadius: 10, padding: '12px 14px',
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--fg-muted)', marginBottom: 6 }}>
        {label}
      </div>
      {value === null ? <SkeletonBlock w={80} h={20} /> : (
        <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-mono)', color: accent }}>{value}</div>
      )}
      {sub && <div style={{ fontSize: 10, color: 'var(--fg-faint)', marginTop: 3, fontFamily: 'var(--font-mono)' }}>{sub}</div>}
    </div>
  );
}
