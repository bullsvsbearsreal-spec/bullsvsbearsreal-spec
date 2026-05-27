'use client';

/**
 * /admin-panel/affiliates — operator view of the affiliate program.
 *
 * Sections:
 *   1. KPI strip — clicks · signups · conversions · revenue (30d)
 *   2. Daily clicks-vs-signups chart (lightweight SVG, no Recharts dep)
 *   3. Pending payouts queue — affiliates with owed commission, sorted DESC
 *   4. Top earners table — lifetime commission, signups, conversions
 *      with CSV export action and a copy-wallet-address quick-action
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { ArrowLeft, Gift, RefreshCw, Download, Mail, Lock, Copy, Check } from 'lucide-react';
import { Card, SectionHead, SkeletonBlock, fmtNumber, fmtPct, ToastHost, type ToastMsg } from '../components/primitives';

interface PayoutsResp {
  topEarners: Array<{
    id: string;
    email: string | null;
    name: string | null;
    referralCode: string | null;
    payoutWallet: string | null;
    payoutChain: string | null;
    lifetimeCommissionUsd: number;
    signups: number;
    conversions: number;
  }>;
  pendingPayouts: Array<{
    id: string;
    email: string | null;
    name: string | null;
    payoutWallet: string | null;
    payoutChain: string | null;
    owedUsd: number;
  }>;
  clicksSignups: Array<{ day: string; clicks: number; signups: number }>;
  tally: {
    clicks30d: number;
    signups30d: number;
    conversions30d: number;
    revenue30dUsd: number;
  };
}

function fmtUsd(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function AffiliatesAdminPage() {
  const { data: session, status } = useSession();
  const role = session?.user?.role;
  const hasAccess = role === 'admin' || role === 'advisor';

  const [data, setData] = useState<PayoutsResp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<ToastMsg | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/affiliates/payouts');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!hasAccess) return;
    load();
    const id = setInterval(load, 120_000);
    return () => clearInterval(id);
  }, [hasAccess, load]);

  // Conversion-rate derived series for the chart
  const chartMax = useMemo(() => {
    if (!data?.clicksSignups.length) return 1;
    return Math.max(1, ...data.clicksSignups.map(d => Math.max(d.clicks, d.signups)));
  }, [data]);

  const copyWallet = async (addr: string) => {
    try {
      await navigator.clipboard.writeText(addr);
      setCopied(addr);
      setTimeout(() => setCopied(null), 1500);
      setToast({ msg: 'Wallet address copied', ok: true });
    } catch {
      setToast({ msg: 'Copy failed', ok: false });
    }
  };

  // ─── Auth gate ───────────────────────────────────────────────────
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-hub-black">
        <Header />
        <main style={{ padding: 80, textAlign: 'center' }}>
          <div style={{ display: 'inline-block', width: 28, height: 28, border: '2px solid rgba(251,191,36,0.3)', borderTopColor: '#fbbf24', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        </main>
        <Footer />
      </div>
    );
  }
  if (!session?.user || !hasAccess) {
    return (
      <div className="min-h-screen bg-hub-black">
        <Header />
        <main style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '80px 16px', color: '#fff' }}>
          <Lock style={{ width: 28, height: 28, color: '#fbbf24', marginBottom: 14 }} />
          <div style={{ color: 'var(--fg-muted)', fontSize: 13, marginBottom: 14 }}>Admin access required</div>
          <a href="/login?callbackUrl=/admin-panel/affiliates" style={{ padding: '8px 18px', borderRadius: 8, background: '#fbbf24', color: '#000', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>Log in</a>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main style={{ color: '#fff' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '20px 24px' }}>

          {/* Breadcrumb */}
          <Link href="/admin-panel#overview" style={{ fontSize: 11, color: 'var(--fg-muted)', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 10, textDecoration: 'none' }}>
            <ArrowLeft style={{ width: 12, height: 12 }} />
            Back to dashboard
          </Link>

          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 18 }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Gift style={{ width: 18, height: 18, color: '#34d399' }} />
                Affiliate Program
              </h1>
              <p style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 4 }}>
                Top earners · pending payouts · 30-day funnel
              </p>
            </div>
            <button
              type="button"
              onClick={load}
              disabled={refreshing}
              style={{ fontSize: 11, color: 'var(--fg-default)', background: 'transparent', border: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}
            >
              <RefreshCw style={{ width: 13, height: 13, ...(refreshing ? { animation: 'spin 1s linear infinite' } : {}) }} />
              Refresh
            </button>
          </div>

          {error && (
            <div style={{ background: 'rgba(244, 63, 94, 0.08)', border: '1px solid rgba(244, 63, 94, 0.3)', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 12, color: '#fda4af' }}>
              {error}
            </div>
          )}

          {/* KPI strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 18 }}>
            <KpiTile label="Clicks · 30d"      value={data ? fmtNumber(data.tally.clicks30d)      : null} accent="#7dd3fc" />
            <KpiTile label="Signups · 30d"     value={data ? fmtNumber(data.tally.signups30d)     : null} accent="#fcd34d"
                     sub={data && data.tally.clicks30d > 0 ? `${fmtPct((data.tally.signups30d / data.tally.clicks30d) * 100)} of clicks` : null} />
            <KpiTile label="Conversions · 30d" value={data ? fmtNumber(data.tally.conversions30d) : null} accent="#34d399"
                     sub={data && data.tally.signups30d > 0 ? `${fmtPct((data.tally.conversions30d / data.tally.signups30d) * 100)} of signups` : null} />
            <KpiTile label="Revenue · 30d"     value={data ? fmtUsd(data.tally.revenue30dUsd)     : null} accent="#c4b5fd" />
          </div>

          {/* Clicks vs signups chart */}
          <SectionHead title="Clicks vs Signups · last 30 days" icon={<span style={{ width: 8, height: 8, background: '#7dd3fc', borderRadius: 2, display: 'inline-block' }} />} />
          <Card title="Daily aggregate">
            {!data ? <SkeletonBlock h={120} /> :
             data.clicksSignups.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--fg-faint)', textAlign: 'center', padding: '20px 0' }}>
                No affiliate clicks recorded in the last 30 days.
              </div>
            ) : (
              <ClicksSignupsChart points={data.clicksSignups} max={chartMax} />
            )}
          </Card>

          {/* Pending payouts */}
          <SectionHead title="Pending Payouts" icon={<span style={{ width: 8, height: 8, background: '#fcd34d', borderRadius: 2, display: 'inline-block' }} />} right={
            data && data.pendingPayouts.length > 0 ? (
              <span style={{ fontSize: 10, color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)' }}>
                {fmtUsd(data.pendingPayouts.reduce((s, p) => s + p.owedUsd, 0))} total owed
              </span>
            ) : null
          } />
          <Card title="Conversions not yet paid out">
            {!data ? <SkeletonBlock h={80} /> :
             data.pendingPayouts.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--fg-faint)', textAlign: 'center', padding: '20px 0' }}>
                Nothing pending — every conversion has been paid.
              </div>
            ) : (
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--fg-faint)' }}>
                    <th style={{ textAlign: 'left',  padding: '6px 0',  fontWeight: 700 }}>Affiliate</th>
                    <th style={{ textAlign: 'left',  padding: '6px 8px', fontWeight: 700 }}>Wallet</th>
                    <th style={{ textAlign: 'right', padding: '6px 0',  fontWeight: 700 }}>Owed</th>
                    <th style={{ textAlign: 'right', padding: '6px 0',  fontWeight: 700, width: 90 }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.pendingPayouts.map(p => (
                    <tr key={p.id} style={{ borderTop: '1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ padding: '8px 0' }}>
                        <div style={{ color: '#fff', fontSize: 12, fontWeight: 600 }}>
                          {p.name || p.email?.split('@')[0] || '(unnamed)'}
                        </div>
                        {p.email && <div style={{ fontSize: 10, color: 'var(--fg-faint)', fontFamily: 'var(--font-mono)' }}>{p.email}</div>}
                      </td>
                      <td style={{ padding: '8px 8px', fontSize: 11, color: 'var(--fg-muted)' }}>
                        {p.payoutWallet ? (
                          <div>
                            <div style={{ fontFamily: 'var(--font-mono)' }}>
                              {p.payoutWallet.slice(0, 6)}…{p.payoutWallet.slice(-4)}
                            </div>
                            <div style={{ fontSize: 9, color: 'var(--fg-faint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                              {p.payoutChain || '—'}
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--fg-faint)' }}>no wallet set</span>
                        )}
                      </td>
                      <td style={{ padding: '8px 0', textAlign: 'right', fontFamily: 'var(--font-mono)', color: '#fcd34d', fontWeight: 700 }}>
                        {fmtUsd(p.owedUsd)}
                      </td>
                      <td style={{ padding: '8px 0', textAlign: 'right' }}>
                        {p.payoutWallet ? (
                          <button
                            type="button"
                            onClick={() => copyWallet(p.payoutWallet!)}
                            style={{
                              padding: '4px 8px', borderRadius: 4,
                              background: 'rgba(125, 211, 252, 0.12)', color: '#7dd3fc',
                              border: '1px solid rgba(125, 211, 252, 0.25)',
                              fontSize: 10, fontWeight: 600,
                              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 3,
                            }}
                          >
                            {copied === p.payoutWallet ? <Check style={{ width: 10, height: 10 }} /> : <Copy style={{ width: 10, height: 10 }} />}
                            {copied === p.payoutWallet ? 'Copied' : 'Copy'}
                          </button>
                        ) : (
                          <span style={{ fontSize: 10, color: 'var(--fg-faint)' }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          {/* Top earners */}
          <SectionHead
            title="Top Earners"
            icon={<span style={{ width: 8, height: 8, background: '#34d399', borderRadius: 2, display: 'inline-block' }} />}
            right={
              <a
                href="/api/admin/affiliates/payouts"
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 10, color: 'var(--fg-muted)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 3 }}
              >
                <Download style={{ width: 11, height: 11 }} />
                raw JSON
              </a>
            }
          />
          <Card title="Lifetime ranked by commission paid">
            {!data ? <SkeletonBlock h={120} /> :
             data.topEarners.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--fg-faint)', textAlign: 'center', padding: '20px 0' }}>
                No affiliate activity yet. Earners will surface once referrals start landing.
              </div>
            ) : (
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--fg-faint)' }}>
                    <th style={{ textAlign: 'left',  padding: '6px 0',  fontWeight: 700 }}>Affiliate</th>
                    <th style={{ textAlign: 'left',  padding: '6px 8px', fontWeight: 700 }}>Code</th>
                    <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 700 }}>Signups</th>
                    <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 700 }}>Conv.</th>
                    <th style={{ textAlign: 'right', padding: '6px 0',  fontWeight: 700 }}>Lifetime commission</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topEarners.map(e => (
                    <tr key={e.id} style={{ borderTop: '1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ padding: '8px 0' }}>
                        <div style={{ color: '#fff', fontWeight: 600, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {e.name || e.email?.split('@')[0] || '(unnamed)'}
                        </div>
                        {e.email && <div style={{ fontSize: 10, color: 'var(--fg-faint)', fontFamily: 'var(--font-mono)' }}>{e.email}</div>}
                      </td>
                      <td style={{ padding: '8px 8px', fontFamily: 'var(--font-mono)', fontSize: 11, color: '#fcd34d' }}>{e.referralCode || '—'}</td>
                      <td style={{ padding: '8px 8px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{fmtNumber(e.signups)}</td>
                      <td style={{ padding: '8px 8px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{fmtNumber(e.conversions)}</td>
                      <td style={{ padding: '8px 0',  textAlign: 'right', fontFamily: 'var(--font-mono)', color: '#34d399', fontWeight: 700 }}>{fmtUsd(e.lifetimeCommissionUsd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      </main>
      <Footer />
      <ToastHost toast={toast} onClear={() => setToast(null)} />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────────────
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

function ClicksSignupsChart({ points, max }: { points: { day: string; clicks: number; signups: number }[]; max: number }) {
  const w = 800, h = 120, pad = 18;
  const xStep = (w - pad * 2) / Math.max(1, points.length - 1);
  const yFor = (v: number) => h - pad - (v / max) * (h - pad * 2);

  const clicksPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${(pad + i * xStep).toFixed(1)} ${yFor(p.clicks).toFixed(1)}`).join(' ');
  const signupsPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${(pad + i * xStep).toFixed(1)} ${yFor(p.signups).toFixed(1)}`).join(' ');

  return (
    <div style={{ overflow: 'hidden' }}>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: '100%', height: 140 }} aria-hidden>
        <path d={clicksPath}  fill="none" stroke="#7dd3fc" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
        <path d={signupsPath} fill="none" stroke="#fcd34d" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div style={{ display: 'flex', gap: 14, marginTop: 4, fontSize: 10, color: 'var(--fg-muted)' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 8, height: 2, background: '#7dd3fc', display: 'inline-block' }} /> Clicks
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 8, height: 2, background: '#fcd34d', display: 'inline-block' }} /> Signups
        </span>
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)' }}>{points[0]?.day} → {points[points.length - 1]?.day}</span>
      </div>
    </div>
  );
}
