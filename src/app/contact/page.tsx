'use client';

/**
 * /contact — public-facing support ticket submission.
 *
 * For logged-in users: file a support ticket directly into the queue
 * via POST /api/support/tickets. Tickets land in /mod-panel#tickets
 * and /support-panel for the team to claim and respond to.
 *
 * For logged-out visitors: prompts sign-in (so we have a real account
 * to attach the ticket to + the customer's email for replies).
 *
 * This is for product/billing/account questions. Bug reports still go
 * through the floating ReportBugButton in the corner of every page
 * (which fires off to Telegram for fast triage of breakage).
 */

import { useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { MessageSquare, Send, Check, AlertCircle, LogIn, Mail } from 'lucide-react';

type Priority = 'low' | 'normal' | 'high' | 'urgent';

const PRIORITY_LABEL: Record<Priority, string> = {
  low:    'Low — no rush',
  normal: 'Normal',
  high:   'High — affecting my trading',
  urgent: 'Urgent — money at risk',
};

export default function ContactPage() {
  const { data: session, status } = useSession();

  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState<Priority>('normal');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedId, setSubmittedId] = useState<number | null>(null);

  const submit = useCallback(async () => {
    if (subject.trim().length < 3) { setError('Subject is too short.'); return; }
    if (body.trim().length < 10) { setError('Please describe the issue in more detail.'); return; }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: subject.trim(),
          body: body.trim(),
          priority,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || `HTTP ${res.status}`);
        return;
      }
      setSubmittedId(Number(json.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setSubmitting(false);
    }
  }, [subject, body, priority]);

  const loggedIn = !!session?.user;
  const ready = status !== 'loading';

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />

      <main id="main-content" className="max-w-2xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        {/* ─── Hero ─── */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-400/25 text-amber-300 text-xs font-semibold mb-5">
            <MessageSquare className="w-3.5 h-3.5" />
            Support
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-3">
            Contact us
          </h1>
          <p className="text-neutral-400 text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
            Account, billing, or product questions — open a ticket and our team
            replies via email. For bug reports, use the &quot;Report&quot; button in the
            bottom-right of any page (we triage those faster).
          </p>
        </div>

        {/* ─── Submitted state ─── */}
        {submittedId != null ? (
          <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/[0.06] p-6 text-center">
            <Check className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
            <h2 className="text-lg font-semibold text-white mb-2">Ticket #{submittedId} received</h2>
            <p className="text-sm text-neutral-400 mb-5">
              We&apos;ll reply to <strong className="text-white">{session?.user?.email}</strong> within 24 hours.
              You can keep replying to this thread by email.
            </p>
            <button
              onClick={() => { setSubmittedId(null); setSubject(''); setBody(''); setPriority('normal'); }}
              className="text-xs text-amber-300 hover:text-amber-200 underline-offset-2 hover:underline"
            >
              Open another ticket
            </button>
          </div>
        ) : !ready ? (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 text-center text-sm text-neutral-500">
            Loading…
          </div>
        ) : !loggedIn ? (
          /* ─── Logged-out fallback ─── */
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 text-center">
            <LogIn className="w-8 h-8 text-amber-300 mx-auto mb-3" />
            <h2 className="text-lg font-semibold text-white mb-2">Sign in to open a ticket</h2>
            <p className="text-sm text-neutral-400 mb-5 max-w-md mx-auto">
              Your account email becomes the reply address. If you don&apos;t have
              an account yet, you can also reach us by email.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Link
                href="/login?callbackUrl=/contact"
                className="inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-lg bg-amber-500 text-black hover:bg-amber-400 transition-colors"
              >
                <LogIn className="w-3.5 h-3.5" />
                Log in
              </Link>
              <a
                href="mailto:support@info-hub.io"
                className="inline-flex items-center gap-2 text-sm font-semibold px-3.5 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-neutral-300 hover:bg-white/[0.08] hover:text-white transition-colors"
              >
                <Mail className="w-3.5 h-3.5" />
                Email instead
              </a>
            </div>
          </div>
        ) : (
          /* ─── Ticket form ─── */
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 sm:p-6 space-y-4">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-500 mb-1.5 block">
                Subject
              </label>
              <input
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="e.g. Can't connect my Binance API key"
                maxLength={200}
                className="w-full px-3 py-2 bg-white/[0.03] border border-white/[0.08] rounded-lg text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-amber-400/40"
              />
            </div>

            <div>
              <label className="text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-500 mb-1.5 block">
                Describe the issue
              </label>
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                rows={6}
                placeholder="What were you trying to do? What happened instead? Steps to reproduce help us a lot."
                maxLength={10_000}
                className="w-full px-3 py-2 bg-white/[0.03] border border-white/[0.08] rounded-lg text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-amber-400/40 resize-vertical font-sans"
              />
              <div className="text-[10px] text-neutral-600 mt-1 text-right font-mono">
                {body.length} / 10,000
              </div>
            </div>

            <div>
              <label className="text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-500 mb-1.5 block">
                Priority
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {(['low', 'normal', 'high', 'urgent'] as Priority[]).map(p => {
                  const active = priority === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPriority(p)}
                      className={`px-2.5 py-1.5 rounded-md text-[11px] font-semibold transition-colors border ${
                        active
                          ? 'bg-amber-500/15 border-amber-400/40 text-amber-200'
                          : 'bg-white/[0.02] border-white/[0.06] text-neutral-400 hover:bg-white/[0.04]'
                      }`}
                      title={PRIORITY_LABEL[p]}
                    >
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </button>
                  );
                })}
              </div>
            </div>

            {error && (
              <div role="alert" className="flex items-start gap-2 text-xs text-rose-300 bg-rose-500/[0.06] border border-rose-400/20 rounded-lg p-2.5">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <span className="text-[10px] text-neutral-600">
                Reply will go to <strong className="text-neutral-400">{session.user?.email}</strong>
              </span>
              <button
                type="button"
                onClick={submit}
                disabled={submitting || subject.trim().length < 3 || body.trim().length < 10}
                className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg bg-amber-500 text-black hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                {submitting ? 'Sending…' : 'Send ticket'}
              </button>
            </div>
          </div>
        )}

        {/* ─── Other channels ─── */}
        <div className="mt-8 text-center text-xs text-neutral-500">
          Prefer email? Reach us at{' '}
          <a href="mailto:support@info-hub.io" className="text-amber-300 hover:text-amber-200 underline-offset-2 hover:underline">
            support@info-hub.io
          </a>
        </div>
      </main>

      <Footer />
    </div>
  );
}
