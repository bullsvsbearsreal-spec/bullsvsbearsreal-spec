'use client';

/**
 * <OnboardingTour /> — first-time-user guided intro.
 *
 * Renders a 5-step modal sequence over the page chrome on first
 * /dashboard visit. Each step highlights one feature the new user
 * should know about. Closes on Done, Esc, or backdrop click;
 * completion persists in localStorage so it never re-fires for the
 * same browser.
 *
 * Why client-side localStorage and not a DB column? Two reasons:
 *   1. The signup flow already issues a verification email; one more
 *      DB write on every dashboard load is wasteful.
 *   2. The cost of someone seeing the tour twice (cleared cookies,
 *      new device) is zero — it's helpful, not gating.
 *
 * Drop the component anywhere; it self-mounts on /dashboard via the
 * dashboard page. If localStorage is unavailable (private browsing,
 * SSR), the tour renders once per session and that's fine.
 */

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Sparkles, Zap, Bell, Gift, LayoutDashboard, ArrowRight, X as XIcon,
  type LucideIcon,
} from 'lucide-react';

const LS_KEY = 'infohub_onboarding_v1';

interface Step {
  /** Icon component from lucide-react. */
  icon: LucideIcon;
  /** Step accent — drives the chip + icon colour. */
  accent: 'amber' | 'emerald' | 'sky' | 'rose' | 'violet';
  title: string;
  body: React.ReactNode;
  /** Optional CTA — when present, surfaces below the body and counts
   *  as completion if clicked. Useful for "open this page now" steps. */
  cta?: { label: string; href: string };
}

const STEPS: Step[] = [
  {
    icon: Sparkles,
    accent: 'amber',
    title: "Welcome to InfoHub",
    body: (
      <>
        <p style={{ margin: '0 0 8px' }}>
          The data terminal across <strong style={{ color: '#fff' }}>every major crypto exchange</strong> — funding, OI,
          liquidations, spreads, whales, signals.
        </p>
        <p style={{ margin: 0, color: '#a3a3a3', fontSize: 12 }}>
          Free during launch. No card required. 30-second tour will show you what to do first.
        </p>
      </>
    ),
  },
  {
    icon: Zap,
    accent: 'emerald',
    title: "Find your first arb",
    body: (
      <>
        <p style={{ margin: '0 0 8px' }}>
          The <strong style={{ color: '#fff' }}>Funding Arb</strong> scanner shows live cross-venue pairs graded
          A → D. Long the cheap side, short the rich side, net of fees.
        </p>
        <p style={{ margin: 0, color: '#a3a3a3', fontSize: 12 }}>
          The Spreads page does the fee math for direct arb opportunities.
        </p>
      </>
    ),
    cta: { label: 'Open Funding Arb', href: '/funding-arb' },
  },
  {
    icon: Bell,
    accent: 'sky',
    title: "Set an alert before you forget",
    body: (
      <>
        <p style={{ margin: '0 0 8px' }}>
          Get notified when funding flips, OI surges, or a watched wallet opens a position. Telegram, email,
          or browser push.
        </p>
        <p style={{ margin: 0, color: '#a3a3a3', fontSize: 12 }}>
          Free tier covers 5 active rules — easily enough for your top symbols.
        </p>
      </>
    ),
    cta: { label: 'Create an alert', href: '/alerts' },
  },
  {
    icon: Gift,
    accent: 'violet',
    title: "Earn 20% by sharing your link",
    body: (
      <>
        <p style={{ margin: '0 0 8px' }}>
          Every account gets an <strong style={{ color: '#fff' }}>affiliate code</strong>. Anyone who signs up via your link
          gets 10% off forever — and you earn 20% of their subscription for life. Paid in USDT.
        </p>
        <p style={{ margin: 0, color: '#a3a3a3', fontSize: 12 }}>
          Set your USDT wallet now so the commissions go to the right place when paid launches.
        </p>
      </>
    ),
    cta: { label: 'Grab my referral link', href: '/settings/referrals' },
  },
  {
    icon: LayoutDashboard,
    accent: 'rose',
    title: "Make the dashboard yours",
    body: (
      <>
        <p style={{ margin: '0 0 8px' }}>
          The standard dashboard works for everyone. But you can build a custom one with the widgets you
          actually use — funding for your favourite symbol, your watchlist, your alerts.
        </p>
        <p style={{ margin: 0, color: '#a3a3a3', fontSize: 12 }}>
          Drag widgets in, drop them where you want, layout auto-saves. (Pro tier feature — free during launch.)
        </p>
      </>
    ),
    cta: { label: 'Try Custom Dashboard', href: '/dashboard/widgets' },
  },
];

const ACCENT_STYLES: Record<Step['accent'], { color: string; bg: string; border: string }> = {
  amber:   { color: '#fbbf24', bg: 'rgba(251,191,36,0.10)', border: 'rgba(251,191,36,0.30)' },
  emerald: { color: '#34d399', bg: 'rgba(52,211,153,0.10)', border: 'rgba(52,211,153,0.30)' },
  sky:     { color: '#7dd3fc', bg: 'rgba(125,211,252,0.10)', border: 'rgba(125,211,252,0.30)' },
  rose:    { color: '#f472b6', bg: 'rgba(244,114,182,0.10)', border: 'rgba(244,114,182,0.30)' },
  violet:  { color: '#c4b5fd', bg: 'rgba(196,181,253,0.10)', border: 'rgba(196,181,253,0.30)' },
};

/**
 * Reads localStorage to decide whether the tour should show. Returns
 * `null` during the first client render to avoid an SSR/CSR mismatch
 * — the tour either appears on the second tick or never.
 */
function shouldShowTour(): boolean | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    return localStorage.getItem(LS_KEY) !== 'completed';
  } catch {
    return false;
  }
}

export default function OnboardingTour() {
  // null = haven't checked yet; false = checked + dismissed; true = open
  const [open, setOpen] = useState<boolean | null>(null);
  const [stepIdx, setStepIdx] = useState(0);

  useEffect(() => {
    setOpen(shouldShowTour() ?? false);
  }, []);

  const close = useCallback((markCompleted: boolean) => {
    if (markCompleted) {
      try { localStorage.setItem(LS_KEY, 'completed'); } catch { /* ignore */ }
    }
    setOpen(false);
  }, []);

  // Esc to close + body scroll lock while open. Esc dismisses without
  // marking completed (so the user can finish on next visit if they
  // pressed it by accident); the Done button marks completed.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(false); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, close]);

  if (!open) return null;

  const step = STEPS[stepIdx];
  const StepIcon = step.icon;
  const accent = ACCENT_STYLES[step.accent];
  const isLast = stepIdx === STEPS.length - 1;
  const isFirst = stepIdx === 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-title"
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
      onClick={() => close(false)}
    >
      <div
        style={{
          maxWidth: 440, width: '100%',
          background: '#0a0a0a',
          border: `1px solid ${accent.border}`,
          borderRadius: 16,
          padding: '28px 24px 22px',
          color: '#e5e5e5',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close (X) — dismisses without marking completed */}
        <button
          type="button"
          onClick={() => close(false)}
          aria-label="Dismiss tour (it'll come back next time)"
          style={{
            position: 'absolute', top: 12, right: 12,
            background: 'transparent', border: 0, cursor: 'pointer',
            color: '#737373', padding: 4,
          }}
        >
          <XIcon className="w-4 h-4" />
        </button>

        {/* Step badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '5px 11px', borderRadius: 999,
          background: accent.bg, border: `1px solid ${accent.border}`,
          color: accent.color, fontSize: 11, fontWeight: 600,
          marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.08em',
        }}>
          <StepIcon className="w-3 h-3" aria-hidden />
          Step {stepIdx + 1} of {STEPS.length}
        </div>

        {/* Title */}
        <h2 id="tour-title" style={{
          fontSize: 22, fontWeight: 700, color: '#fff',
          letterSpacing: '-0.02em', margin: '0 0 12px',
        }}>
          {step.title}
        </h2>

        {/* Body */}
        <div style={{ fontSize: 14, lineHeight: 1.55, color: '#d4d4d4' }}>
          {step.body}
        </div>

        {/* Optional inline CTA — opens the destination in the same tab.
            Counts as completion of this step (we advance + persist). */}
        {step.cta && (
          <Link
            href={step.cta.href}
            onClick={() => {
              // Mark as completed before navigating — they got what they came for
              try { localStorage.setItem(LS_KEY, 'completed'); } catch { /* ignore */ }
            }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              marginTop: 18, padding: '8px 14px', borderRadius: 8,
              background: accent.bg, border: `1px solid ${accent.border}`,
              color: accent.color, fontSize: 13, fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            {step.cta.label}
            <ArrowRight className="w-3 h-3" aria-hidden />
          </Link>
        )}

        {/* Dot indicator + nav buttons */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginTop: 22, paddingTop: 16, borderTop: '1px solid #262626',
        }}>
          {/* Dots */}
          <div style={{ display: 'flex', gap: 6 }}>
            {STEPS.map((_, i) => (
              <span
                key={i}
                aria-label={`Step ${i + 1}${i === stepIdx ? ' (current)' : ''}`}
                style={{
                  width: i === stepIdx ? 18 : 6, height: 6, borderRadius: 999,
                  background: i === stepIdx ? accent.color : '#3f3f3f',
                  transition: 'all 0.2s',
                }}
              />
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => setStepIdx(isFirst ? 0 : stepIdx - 1)}
              disabled={isFirst}
              style={{
                padding: '7px 13px', borderRadius: 7, fontSize: 12, fontWeight: 600,
                background: 'transparent', color: isFirst ? '#3f3f3f' : '#a3a3a3',
                border: '1px solid #262626', cursor: isFirst ? 'default' : 'pointer',
              }}
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => (isLast ? close(true) : setStepIdx(stepIdx + 1))}
              style={{
                padding: '7px 17px', borderRadius: 7, fontSize: 12, fontWeight: 700,
                background: accent.color, color: '#0a0a0a', border: 0, cursor: 'pointer',
                textTransform: 'uppercase', letterSpacing: '0.05em',
              }}
            >
              {isLast ? 'Done' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
