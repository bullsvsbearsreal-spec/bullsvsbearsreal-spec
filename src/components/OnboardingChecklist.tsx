'use client';

/**
 * OnboardingChecklist — 5-step setup widget shown on /home for users
 * who haven't finished setting up.
 *
 * Steps:
 *   1. Verify your email
 *   2. Set a display name
 *   3. Connect Telegram for alerts
 *   4. Watch your first wallet
 *   5. Set your first price alert
 *
 * State comes from /api/account/onboarding-status. Auto-hides when:
 *   - User isn't logged in
 *   - All 5 steps complete
 *   - User clicked "Dismiss" (persisted to localStorage)
 *
 * Each step links to where the action happens. Click a completed step
 * to see the relevant settings page; click an incomplete step to start
 * the missing setup.
 */

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Check, ChevronRight, X, Mail, User, Send, Eye, Bell, Sparkles } from 'lucide-react';

interface Status {
  emailVerified: boolean;
  hasDisplayName: boolean;
  telegramLinked: boolean;
  firstWalletWatch: boolean;
  firstAlert: boolean;
  completedCount: number;
  totalCount: number;
}

const DISMISS_KEY = 'ih:onboarding-dismissed-v1';

const STEPS = [
  {
    key: 'emailVerified',
    label: 'Verify your email',
    href: '/verify-email',
    icon: Mail,
    detail: 'Confirms you can receive password resets + critical account notices.',
  },
  {
    key: 'hasDisplayName',
    label: 'Set a display name',
    href: '/profile',
    icon: User,
    detail: 'Shows up on the public affiliate leaderboard if you opt in.',
  },
  {
    key: 'telegramLinked',
    label: 'Connect Telegram',
    href: '/account/connections',
    icon: Send,
    detail: 'Real-time alert delivery channel — much faster than email.',
  },
  {
    key: 'firstWalletWatch',
    label: 'Watch your first wallet',
    href: '/watch',
    icon: Eye,
    detail: 'Get pinged when an HL/gTrade wallet opens, closes, or hits liq danger.',
  },
  {
    key: 'firstAlert',
    label: 'Set your first price alert',
    href: '/alerts',
    icon: Bell,
    detail: 'Liquidation cascade, funding spike, OI jump — pick a signal that matters.',
  },
] as const;

export default function OnboardingChecklist() {
  const { data: session, status: authStatus } = useSession();
  const [status, setStatus] = useState<Status | null>(null);
  const [dismissed, setDismissed] = useState<boolean>(false);
  const [collapsed, setCollapsed] = useState<boolean>(false);

  // Read the dismissal flag once on mount. Done in useEffect (not at
  // render time) to avoid hydration mismatches between server + client.
  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISS_KEY) === '1') setDismissed(true);
    } catch { /* SSR or storage blocked — leave dismissed = false */ }
  }, []);

  // Fetch onboarding state. Re-runs on auth change so a fresh login
  // picks up the user's state. No polling — the user takes actions on
  // other pages, then a navigation back to /home re-mounts this and
  // re-fetches naturally.
  useEffect(() => {
    if (authStatus !== 'authenticated' || !session?.user?.id) {
      setStatus(null);
      return;
    }
    let cancelled = false;
    fetch('/api/account/onboarding-status')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (!cancelled && d) setStatus(d as Status); })
      .catch(() => { /* swallow — silent failure is fine, widget just won't render */ });
    return () => { cancelled = true; };
  }, [authStatus, session?.user?.id]);

  const dismiss = useCallback(() => {
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch {}
    setDismissed(true);
  }, []);

  // Don't render until we have data + the user is logged in + they
  // haven't dismissed + there's actually something to do.
  if (authStatus !== 'authenticated' || !status || dismissed) return null;
  if (status.completedCount >= status.totalCount) return null;

  const pct = Math.round((status.completedCount / status.totalCount) * 100);

  return (
    <section
      aria-label="Get started checklist"
      style={{
        marginBottom: 14,
        background: 'linear-gradient(135deg, rgba(245, 166, 35, 0.04) 0%, rgba(167, 139, 250, 0.04) 100%)',
        border: '1px solid rgba(245, 166, 35, 0.2)',
        borderRadius: 12,
        padding: 14,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: collapsed ? 0 : 12 }}>
        <Sparkles size={14} style={{ color: 'var(--hub-accent)', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 style={{
              fontSize: 12, fontWeight: 700, color: '#fff',
              letterSpacing: '0.04em', textTransform: 'uppercase',
              margin: 0, whiteSpace: 'nowrap',
            }}>
              Set up your account
            </h2>
            <span style={{
              fontSize: 10, color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)',
            }}>
              {status.completedCount}/{status.totalCount} · {pct}%
            </span>
          </div>
          {/* Progress bar */}
          <div style={{
            marginTop: 5, height: 3, borderRadius: 999,
            background: 'rgba(255, 255, 255, 0.06)', overflow: 'hidden',
          }}>
            <div
              style={{
                height: '100%', width: `${pct}%`,
                background: 'linear-gradient(90deg, var(--hub-accent), var(--hub-accent-light))',
                borderRadius: 999, transition: 'width 300ms ease',
              }}
            />
          </div>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(v => !v)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand checklist' : 'Collapse checklist'}
          style={{
            background: 'transparent', border: 0, padding: 4, cursor: 'pointer',
            color: 'var(--fg-muted)', display: 'inline-flex',
          }}
        >
          <ChevronRight size={14} style={{ transform: collapsed ? 'rotate(0deg)' : 'rotate(90deg)', transition: 'transform 200ms' }} />
        </button>
        <button
          type="button"
          onClick={dismiss}
          title="Dismiss — hide forever"
          aria-label="Dismiss onboarding checklist"
          style={{
            background: 'transparent', border: 0, padding: 4, cursor: 'pointer',
            color: 'var(--fg-faint)', display: 'inline-flex',
          }}
        >
          <X size={13} />
        </button>
      </div>

      {!collapsed && (
        <ul style={{
          listStyle: 'none', margin: 0, padding: 0,
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 6,
        }}>
          {STEPS.map(step => {
            const done = !!status[step.key as keyof Status];
            const Icon = step.icon;
            return (
              <li key={step.key}>
                <Link
                  href={step.href}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    padding: '8px 10px', borderRadius: 8,
                    background: done ? 'rgba(52, 211, 153, 0.06)' : 'rgba(255, 255, 255, 0.025)',
                    border: `1px solid ${done ? 'rgba(52, 211, 153, 0.2)' : 'var(--hub-border-subtle)'}`,
                    textDecoration: 'none',
                    transition: 'background 150ms, border-color 150ms',
                  }}
                >
                  <span style={{
                    flexShrink: 0,
                    width: 18, height: 18, borderRadius: 4,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    background: done ? 'rgba(52, 211, 153, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                    color: done ? '#34d399' : 'var(--fg-muted)',
                    border: `1px solid ${done ? 'rgba(52, 211, 153, 0.4)' : 'var(--hub-border-subtle)'}`,
                  }}>
                    {done ? <Check size={11} /> : <Icon size={11} />}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{
                      display: 'block',
                      fontSize: 12, fontWeight: 600,
                      color: done ? 'var(--fg-muted)' : '#fff',
                      textDecoration: done ? 'line-through' : 'none',
                    }}>{step.label}</span>
                    <span style={{
                      display: 'block',
                      fontSize: 10, color: 'var(--fg-faint)',
                      marginTop: 2, lineHeight: 1.4,
                    }}>{step.detail}</span>
                  </span>
                  {!done && <ChevronRight size={11} style={{ color: 'var(--fg-faint)', flexShrink: 0, marginTop: 4 }} />}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
