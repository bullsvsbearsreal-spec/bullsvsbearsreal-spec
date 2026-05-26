'use client';

/**
 * /settings/referrals — private affiliate dashboard.
 *
 * Shows the user's referral code + share link, summary stats (clicks,
 * signups, conversions, pending USDT), the recent event log, and the
 * USDT payout-wallet config form. Public landing + program FAQ live at
 * /referrals (not /settings/referrals).
 */

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import PageHero from '@/components/PageHero';
import { Gift, Copy, ExternalLink, Wallet, Check, AlertCircle, ArrowRight } from 'lucide-react';

interface ReferralEvent {
  id: number;
  eventType: 'click' | 'signup' | 'conversion' | 'payout';
  referredUserId: string | null;
  amountUsd: number | null;
  commissionUsd: number | null;
  txHash: string | null;
  chain: string | null;
  createdAt: string;
}

interface Summary {
  clicks: number;
  signups: number;
  conversions: number;
  totalCommissionUsd: number;
  paidOutUsd: number;
  pendingUsd: number;
}

interface DashboardData {
  code: string | null;
  link: string | null;
  summary: Summary;
  payout: { wallet: string | null; chain: 'solana' | 'arbitrum' | 'base' | null };
  events: ReferralEvent[];
  terms: {
    commissionPct: number;
    recurring: string;
    cookieDays: number;
    minPayoutUsd: number;
    referredDiscountPct: number;
    referredDiscountDuration: string;
  };
}

export default function ReferralsDashboardPage() {
  const { status } = useSession();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Form state for the payout config
  const [walletInput, setWalletInput] = useState('');
  const [chainInput, setChainInput] = useState<'solana' | 'arbitrum' | 'base' | ''>('');
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/referrals', { cache: 'no-store' });
      if (res.status === 401) {
        setErr('Sign in to see your affiliate dashboard.');
        setLoading(false);
        return;
      }
      if (!res.ok) {
        setErr('Could not load dashboard. Try again.');
        setLoading(false);
        return;
      }
      const j = (await res.json()) as DashboardData;
      setData(j);
      setWalletInput(j.payout.wallet ?? '');
      setChainInput(j.payout.chain ?? '');
      setLoading(false);
    } catch {
      setErr('Network error. Try again.');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'unauthenticated') {
      setErr('Sign in to see your affiliate dashboard.');
      setLoading(false);
      return;
    }
    fetchData();
  }, [status, fetchData]);

  const onSavePayout = async () => {
    setSaving(true);
    setSaveErr(null);
    setSaveOk(false);
    try {
      const res = await fetch('/api/referrals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: walletInput.trim() || null,
          chain: chainInput || null,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        setSaveErr(j?.error || 'Save failed.');
      } else {
        setSaveOk(true);
        // Refresh to get the canonical state
        fetchData();
      }
    } catch {
      setSaveErr('Network error. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main id="main-content" className="max-w-[1100px] mx-auto w-full px-4 sm:px-6 py-6">
        <PageHero
          icon={Gift}
          eyebrow="Affiliate Dashboard"
          title="Your"
          accentNoun="referrals"
          accent="emerald"
          description={
            <>
              Share your link. Earn 20% recurring lifetime on every paid signup.
              Payouts in USDT to the wallet below.{' '}
              <Link href="/referrals" className="text-emerald-300 hover:underline">
                Program terms →
              </Link>
            </>
          }
        />

        {loading && (
          <div className="text-center py-16 text-neutral-500 text-sm">Loading…</div>
        )}

        {err && !loading && (
          <div className="rounded-xl border border-amber-400/30 bg-amber-500/[0.04] p-4 mb-4 text-center">
            <p className="text-[13px] text-amber-200">{err}</p>
            {status === 'unauthenticated' && (
              <Link
                href={`/login?callbackUrl=${encodeURIComponent('/settings/referrals')}`}
                className="inline-flex items-center gap-1.5 mt-3 px-4 py-2 rounded-lg text-[12px] font-semibold bg-emerald-500 text-black hover:bg-emerald-400 transition-colors"
              >
                Sign in <ArrowRight className="w-3 h-3" />
              </Link>
            )}
          </div>
        )}

        {data && !loading && (
          <>
            {/* ─── Code + link ─── */}
            <section className="rounded-xl border border-emerald-400/25 bg-emerald-500/[0.03] p-5 mb-5">
              <div className="flex items-center gap-2 mb-3">
                <Gift className="w-4 h-4 text-emerald-300" aria-hidden />
                <h2 className="text-[13px] font-bold uppercase tracking-wider text-emerald-300">Your code</h2>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <CopyField
                  label="Code"
                  value={data.code ?? '—'}
                  hint="Share this code anywhere — it stamps a 60-day cookie when someone visits with ?ref=CODE"
                />
                <CopyField
                  label="Share link"
                  value={data.link ?? ''}
                  hint={`${data.terms.cookieDays}-day cookie · ${data.terms.referredDiscountPct}% off ${data.terms.referredDiscountDuration} for the referred user`}
                />
              </div>
            </section>

            {/* ─── Summary stats ─── */}
            <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
              <StatCard label="Clicks" value={data.summary.clicks.toLocaleString()} hint="Landings on ?ref=CODE" />
              <StatCard label="Signups" value={data.summary.signups.toLocaleString()} hint="Created an account via you" />
              <StatCard label="Conversions" value={data.summary.conversions.toLocaleString()} hint="First paid month" />
              <StatCard
                label="Pending USDT"
                value={`$${data.summary.pendingUsd.toFixed(2)}`}
                hint={`Min payout $${data.terms.minPayoutUsd}`}
                accent
              />
            </section>

            {/* ─── Payout config ─── */}
            <section className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5 mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Wallet className="w-4 h-4 text-neutral-300" aria-hidden />
                <h2 className="text-[13px] font-bold uppercase tracking-wider text-white">USDT payout</h2>
              </div>
              <p className="text-[12px] text-neutral-400 mb-4">
                Where we send your USDT. Solana, Arbitrum, or Base — pick the one with the lowest fees for you.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-[1fr_220px_120px] gap-3 items-end">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 block font-semibold">
                    Wallet address
                  </label>
                  <input
                    type="text"
                    value={walletInput}
                    onChange={(e) => setWalletInput(e.target.value)}
                    placeholder={chainInput === 'solana' ? 'So1ana base58 address…' : '0x…'}
                    className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[12px] text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 block font-semibold">
                    Chain
                  </label>
                  <select
                    value={chainInput}
                    onChange={(e) => setChainInput(e.target.value as 'solana' | 'arbitrum' | 'base' | '')}
                    className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[12px] text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                  >
                    <option value="">Select chain</option>
                    <option value="solana">Solana</option>
                    <option value="arbitrum">Arbitrum</option>
                    <option value="base">Base</option>
                  </select>
                </div>
                <button
                  type="button"
                  onClick={onSavePayout}
                  disabled={saving}
                  className="px-3 py-2 rounded-lg text-[12px] font-bold uppercase tracking-wider bg-emerald-500 text-black hover:bg-emerald-400 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>

              {saveErr && (
                <p className="text-[12px] text-rose-300 mt-2 inline-flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" aria-hidden /> {saveErr}
                </p>
              )}
              {saveOk && !saveErr && (
                <p className="text-[12px] text-emerald-300 mt-2 inline-flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5" aria-hidden /> Saved.
                </p>
              )}
            </section>

            {/* ─── Recent events ─── */}
            <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden mb-10">
              <div className="px-4 py-3 border-b border-white/[0.06]">
                <h2 className="text-[13px] font-bold uppercase tracking-wider text-white">Recent activity</h2>
              </div>
              {data.events.length === 0 ? (
                <div className="px-4 py-8 text-center text-[12px] text-neutral-500">
                  No activity yet. Share your link and come back here.
                </div>
              ) : (
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="text-left text-[10px] uppercase tracking-wider text-neutral-500">
                      <th className="px-4 py-2 font-semibold">When</th>
                      <th className="px-4 py-2 font-semibold">Event</th>
                      <th className="px-4 py-2 font-semibold text-right">Amount</th>
                      <th className="px-4 py-2 font-semibold text-right">Commission</th>
                      <th className="px-4 py-2 font-semibold">Tx</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.events.map((ev) => (
                      <tr key={ev.id} className="border-t border-white/[0.04]">
                        <td className="px-4 py-2 text-neutral-400">
                          {new Date(ev.createdAt).toLocaleDateString()} · {new Date(ev.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-4 py-2"><EventChip type={ev.eventType} /></td>
                        <td className="px-4 py-2 text-right text-neutral-300 font-mono">
                          {ev.amountUsd != null ? `$${ev.amountUsd.toFixed(2)}` : '—'}
                        </td>
                        <td className="px-4 py-2 text-right text-emerald-300 font-mono">
                          {ev.commissionUsd != null ? `$${ev.commissionUsd.toFixed(2)}` : '—'}
                        </td>
                        <td className="px-4 py-2 text-neutral-500 truncate max-w-[140px] font-mono text-[10px]">
                          {ev.txHash ? ev.txHash.slice(0, 10) + '…' : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}

/* ─── Sub-components ────────────────────────────────────────────────── */

function CopyField({ label, value, hint }: { label: string; value: string; hint?: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };
  return (
    <div className="flex-1">
      <label className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold mb-1 block">{label}</label>
      <div className="flex items-center gap-2 rounded-lg bg-black/30 border border-white/[0.08] px-3 py-2">
        <span className="flex-1 text-[12px] font-mono text-white truncate">{value || '—'}</span>
        <button
          type="button"
          onClick={onCopy}
          disabled={!value}
          aria-label={`Copy ${label}`}
          className="text-neutral-400 hover:text-emerald-300 transition-colors disabled:opacity-30"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
      {hint && <p className="text-[10px] text-neutral-500 mt-1">{hint}</p>}
    </div>
  );
}

function StatCard({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${accent ? 'border-emerald-400/30 bg-emerald-500/[0.04]' : 'border-white/[0.06] bg-white/[0.02]'}`}>
      <p className={`text-[10px] uppercase tracking-wider font-semibold mb-1 ${accent ? 'text-emerald-300' : 'text-neutral-500'}`}>{label}</p>
      <p className={`text-lg font-bold ${accent ? 'text-emerald-200' : 'text-white'}`}>{value}</p>
      {hint && <p className="text-[10px] text-neutral-500 mt-0.5">{hint}</p>}
    </div>
  );
}

function EventChip({ type }: { type: 'click' | 'signup' | 'conversion' | 'payout' }) {
  const styles: Record<string, string> = {
    click:      'bg-white/[0.06] text-neutral-300 border-white/[0.1]',
    signup:     'bg-sky-500/15 text-sky-300 border-sky-400/30',
    conversion: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30',
    payout:     'bg-amber-500/15 text-amber-300 border-amber-400/30',
  };
  return (
    <span className={`inline-flex items-center text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border ${styles[type]}`}>
      {type}
    </span>
  );
}
