'use client';

/**
 * /pricing — public-facing tier comparison page.
 *
 * Three tiers: Free / Pro / Whale. Pro is the conversion target (middle
 * card, "MOST POPULAR" badge). Whale is the premium anchor for funds +
 * power users. All numbers derive from lib/constants/tiers.ts so a tier
 * bump auto-propagates to the cards, the comparison table, and the FAQ.
 *
 * Today (May 2026): paid tiers are FREE DURING LAUNCH. Prices visible
 * with strike-through so users see the future cost, but the "Subscribe"
 * CTAs stub out to a "coming soon" modal until NowPayments is wired.
 */

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import PageHero from '@/components/PageHero';
import { Sparkles, Zap, Crown, Check, X as XIcon, ArrowRight, CreditCard } from 'lucide-react';
import {
  TIER_ORDER,
  TIER_LIMITS,
  TIER_PRICE_MONTHLY,
  TIER_PRICE_ANNUAL,
  TIER_BRANDING,
  FEATURE_MATRIX,
  ANNUAL_DISCOUNT_PCT,
  annualSavingsUsd,
  resolveUserTier,
  type Tier,
} from '@/lib/constants/tiers';

type Period = 'monthly' | 'annual';

function tierIcon(name: 'Sparkles' | 'Zap' | 'Crown') {
  if (name === 'Sparkles') return Sparkles;
  if (name === 'Zap') return Zap;
  return Crown;
}

function formatLimit(value: number): string {
  if (!Number.isFinite(value)) return 'Unlimited';
  return value.toLocaleString();
}

/** "Pro" sits in the middle of the desktop grid but renders FIRST on
 *  mobile per spec (conversion-focused stacking). */
const MOBILE_ORDER: Tier[] = ['pro', 'whale', 'free'];

export default function PricingPage() {
  const { data: session } = useSession();
  const [period, setPeriod] = useState<Period>('monthly');
  const [showCheckoutModal, setShowCheckoutModal] = useState<Tier | null>(null);

  const isSignedIn = !!session;
  const userTier = resolveUserTier({
    role: (session?.user as { role?: string } | undefined)?.role,
    billingTier: null, // billing tier wiring is a follow-up — admins resolve to whale
  });
  // Only mark a card "current" if the user is actually signed in. Logged-out
  // users see signup CTAs on every card (including Free).
  const currentTier: Tier | null = isSignedIn ? userTier : null;

  return (
    <div className="min-h-screen bg-hub-black">
      <Header />
      <main id="main-content" className="max-w-[1100px] mx-auto w-full px-4 sm:px-6 py-6">
        <PageHero
          icon={CreditCard}
          eyebrow="Pricing"
          title="Pick your"
          accentNoun="tier"
          accent="emerald"
          description={
            <>
              Everything is free during launch. Prices below are what each tier will
              cost once we exit the early-access window. Cancel anytime, access until
              the period ends.
            </>
          }
        />

        {/* ─── Launch notice + Monthly/Annual toggle ─── */}
        <section className="rounded-xl border border-amber-400/30 bg-amber-500/[0.04] px-4 py-3 mb-5 text-center">
          <p className="text-[12px] sm:text-[13px] text-amber-200">
            <Sparkles className="inline w-3.5 h-3.5 -mt-0.5 mr-1.5 text-amber-300" aria-hidden />
            <span className="font-semibold text-amber-300">Free during launch</span> · Pro
            + Whale tiers unlocked for every signed-in user while we onboard early users.
          </p>
        </section>

        <div className="flex items-center justify-center mb-6">
          <div role="group" aria-label="Billing period" className="inline-flex rounded-full border border-white/[0.08] bg-white/[0.02] p-1">
            <button
              type="button"
              aria-pressed={period === 'monthly'}
              onClick={() => setPeriod('monthly')}
              className={`px-4 py-1.5 rounded-full text-[12px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 ${
                period === 'monthly'
                  ? 'bg-white/[0.08] text-white'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              aria-pressed={period === 'annual'}
              onClick={() => setPeriod('annual')}
              className={`px-4 py-1.5 rounded-full text-[12px] font-semibold transition-colors inline-flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 ${
                period === 'annual'
                  ? 'bg-white/[0.08] text-white'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Annual
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-400/30">
                Save {ANNUAL_DISCOUNT_PCT}%
              </span>
            </button>
          </div>
        </div>

        {/* ─── Tier cards (Pro in middle on desktop, Pro first on mobile) ─── */}
        {/* DOM order is Pro → Whale → Free, which is the mobile order by
            default (no `order-N` needed). Desktop reorders to Free → Pro →
            Whale via the literal `sm:order-N` classes Tailwind can find. */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          {MOBILE_ORDER.map((t) => {
            const desktopOrder = TIER_ORDER.indexOf(t); // 0=free, 1=pro, 2=whale
            // Literal class strings so Tailwind's content scanner picks them up
            const desktopOrderClass =
              desktopOrder === 0 ? 'sm:order-1'
              : desktopOrder === 1 ? 'sm:order-2'
              : 'sm:order-3';
            return (
              <TierCard
                key={t}
                tier={t}
                period={period}
                isCurrentTier={currentTier === t}
                isMostPopular={t === 'pro'}
                onSubscribe={() => setShowCheckoutModal(t)}
                desktopOrderClass={desktopOrderClass}
              />
            );
          })}
        </section>

        {/* ─── Comparison table ─── */}
        <section className="mb-12">
          <h2 className="text-base font-bold text-white mb-3 px-1">Compare all features</h2>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                    {/* Sticky cell — uses theme-aware `bg-hub-darker` so the
                        column reads correctly in both dark + light mode and
                        body cells stay hidden during horizontal scroll. */}
                    <th scope="col" className="text-left px-4 py-3 text-[10px] uppercase tracking-wider text-neutral-500 font-semibold sticky left-0 bg-hub-darker">
                      Feature
                    </th>
                    {TIER_ORDER.map((t) => {
                      const b = TIER_BRANDING[t];
                      const Icon = tierIcon(b.iconName);
                      return (
                        <th scope="col" key={t} className="px-4 py-3 text-center">
                          <div className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-bold">
                            <Icon className={`w-3 h-3 ${b.textColor}`} aria-hidden />
                            <span className={b.textColor}>{b.label}</span>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {FEATURE_MATRIX.map((row, i) => {
                    const stripe = i % 2 === 0;
                    return (
                      <tr
                        key={row.label}
                        className={`border-b border-white/[0.04] ${
                          stripe ? '' : 'bg-white/[0.01]'
                        }`}
                      >
                        {/* Sticky leftmost cell — theme-aware solid bg
                            (hub-black / hub-dark) so light + dark mode
                            both work and the cells underneath stay
                            hidden during horizontal scroll. `scope="row"`
                            gives screen readers a row-header anchor so
                            each cell announcement starts with the feature
                            label rather than "blank cell". */}
                        <th
                          scope="row"
                          className={`px-4 py-2.5 text-neutral-300 font-normal text-left sticky left-0 ${
                            stripe ? 'bg-hub-black' : 'bg-hub-dark'
                          }`}
                        >
                          {row.label}
                        </th>
                        {TIER_ORDER.map((t) => (
                          <td key={t} className="px-4 py-2.5 text-center">
                            <FeatureCell value={row.values[t]} tier={t} />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ─── FAQ ─── */}
        <section className="mb-12">
          <h2 className="text-base font-bold text-white mb-3 px-1">Pricing FAQ</h2>
          <div className="space-y-2">
            <FaqItem
              q="What happens when launch ends?"
              a="We'll email every signed-in user ahead of time with the exact date. You'll keep all your data and your account; you'll just need to subscribe to keep Pro/Whale features. Free tier stays free forever."
            />
            <FaqItem
              q="How does payment work?"
              a="Crypto via NowPayments — pay in USDT/USDC on Ethereum, Solana, Arbitrum, Base, plus BTC and ETH. Hosted checkout, takes <60s. No card needed, no signup form. (Stripe option will follow.)"
            />
            <FaqItem
              q="Can I cancel anytime?"
              a="Yes. Cancel from your profile billing tab — you keep Pro/Whale access until the end of the current period, then auto-downgrade to Free. No prorated refunds, but no surprises either."
            />
            <FaqItem
              q="What's the difference between Pro and Whale?"
              a="Pro covers most active traders: 500 req/min API, 50 alerts, 100 watched wallets, 1y history. Whale adds custom alert webhooks (deliver to your trading bot), sub-second priority alerts, the raw aggregator WebSocket feed, 5 team seats, and a 1:1 channel with the team for feature requests."
            />
            <FaqItem
              q="Do you charge based on usage?"
              a="No. Flat monthly or annual price — no overage fees, no surprise bills, no metered billing. If you hit a tier limit, the page tells you and offers an upgrade. Nothing breaks silently."
            />
            <FaqItem
              q="Is there a free trial?"
              a="No traditional trial — but right now everyone gets full Pro features free during launch, which is effectively a long open trial. The Free tier itself stays free forever (no card required, no time limit), so you can always test the data terminal without committing to anything."
            />
          </div>
        </section>

        {/* ─── Final CTA ─── */}
        <section className="text-center pb-12">
          <p className="text-[12px] text-neutral-500">
            Questions?{' '}
            <Link href="/faq" className="text-emerald-300 hover:underline">See the full FAQ</Link>
            {' '}or DM us on{' '}
            <a
              href="https://t.me/info_hub69"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-300 hover:underline"
            >
              Telegram
            </a>
            .
          </p>
        </section>
      </main>

      {/* ─── Checkout-coming-soon modal ─── */}
      {showCheckoutModal && (
        <CheckoutComingSoonModal
          tier={showCheckoutModal}
          period={period}
          onClose={() => setShowCheckoutModal(null)}
        />
      )}

      <Footer />
    </div>
  );
}

/* ─── Sub-components ─────────────────────────────────────────────── */

interface TierCardProps {
  tier: Tier;
  period: Period;
  isCurrentTier: boolean;
  isMostPopular: boolean;
  onSubscribe: () => void;
  desktopOrderClass: string;
}

function TierCard({
  tier,
  period,
  isCurrentTier,
  isMostPopular,
  onSubscribe,
  desktopOrderClass,
}: TierCardProps) {
  const b = TIER_BRANDING[tier];
  const limits = TIER_LIMITS[tier];
  const Icon = tierIcon(b.iconName);
  const monthly = TIER_PRICE_MONTHLY[tier];
  const annual = TIER_PRICE_ANNUAL[tier];
  // Annual / 12 produces $40.8333… for Whale; show two decimals so the
  // strikethrough price reads cleanly ($40.83, $10.00) instead of a
  // 14-digit float. Use toFixed only when the value isn't an integer.
  const displayMonthlyRaw = period === 'monthly' ? monthly : annual / 12;
  const displayMonthly = Number.isInteger(displayMonthlyRaw)
    ? displayMonthlyRaw.toString()
    : displayMonthlyRaw.toFixed(2);
  const isPaid = monthly > 0;

  return (
    <div
      className={`relative rounded-xl border-2 ${b.borderTint} ${b.bgTint} p-5 flex flex-col ${desktopOrderClass} ${
        isMostPopular ? 'ring-2 ring-emerald-400/30 ring-offset-2 ring-offset-hub-black' : ''
      }`}
    >
      {isMostPopular && (
        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[9px] font-bold uppercase tracking-[0.15em] px-2.5 py-0.5 rounded-full bg-emerald-500 text-black shadow-lg shadow-emerald-500/30">
          Most popular
        </span>
      )}

      <div className="flex items-center gap-2 mb-3">
        <Icon className={`w-5 h-5 ${b.textColor}`} aria-hidden />
        <h3 className={`text-lg font-bold ${b.textColor}`}>{b.label}</h3>
        {isCurrentTier && (
          <span className="ml-auto text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-white/[0.08] border border-white/[0.1] text-neutral-300">
            Current
          </span>
        )}
      </div>

      <p className="text-[12px] text-neutral-400 mb-4 min-h-[2.5rem]">{b.tagline}</p>

      {/* Price block */}
      <div className="mb-4">
        {isPaid ? (
          <>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-[11px] text-neutral-500 line-through">
                ${displayMonthly}
              </span>
              <span className="text-2xl font-bold text-white">$0</span>
              <span className="text-[12px] text-neutral-500">/mo</span>
            </div>
            <p className="text-[10px] uppercase font-bold tracking-wider text-amber-300">
              Free during launch
            </p>
            {period === 'annual' && (
              <p className="text-[10px] text-neutral-500 mt-1">
                Then ${annual}/yr — save ${annualSavingsUsd(tier)}/yr vs monthly
              </p>
            )}
            {period === 'monthly' && (
              <p className="text-[10px] text-neutral-500 mt-1">
                Then ${monthly}/mo after launch
              </p>
            )}
          </>
        ) : (
          <>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-white">$0</span>
              <span className="text-[12px] text-neutral-500">forever</span>
            </div>
            <p className="text-[10px] text-neutral-500 mt-1">No card required</p>
          </>
        )}
      </div>

      {/* Key bullets */}
      <ul className="space-y-1.5 mb-5 text-[12px] text-neutral-300 flex-1">
        <Bullet>
          API: <strong>{formatLimit(limits.apiPerMinute)}/min</strong>
          {Number.isFinite(limits.apiPerDay) && (
            <>, {formatLimit(limits.apiPerDay)}/day</>
          )}
        </Bullet>
        <Bullet>
          <strong>{formatLimit(limits.maxAlerts)}</strong> custom alerts
        </Bullet>
        <Bullet>
          <strong>{formatLimit(limits.maxWatchedWallets)}</strong> watched wallets
        </Bullet>
        <Bullet>
          <strong>{limits.historyDays >= 365 ? `${Math.round(limits.historyDays / 365)}y` : `${limits.historyDays}d`}</strong> historical data
        </Bullet>
        {tier === 'whale' && (
          <>
            <Bullet>Custom alert webhooks (HTTPS)</Bullet>
            <Bullet>Sub-second priority delivery</Bullet>
            <Bullet>Raw WebSocket feed</Bullet>
            <Bullet>Team seats (up to 5)</Bullet>
          </>
        )}
        {tier === 'pro' && <Bullet>Priority email + DM support</Bullet>}
      </ul>

      {/* CTA */}
      <TierCta
        tier={tier}
        isPaid={isPaid}
        isCurrentTier={isCurrentTier}
        onSubscribe={onSubscribe}
      />
    </div>
  );
}

function TierCta({
  tier,
  isPaid,
  isCurrentTier,
  onSubscribe,
}: {
  tier: Tier;
  isPaid: boolean;
  isCurrentTier: boolean;
  onSubscribe: () => void;
}) {
  const { data: session } = useSession();
  const isSignedIn = !!session;
  const b = TIER_BRANDING[tier];

  // Current-tier "disabled" state (works for all 3 tiers).
  // We render a real <button disabled> so keyboard/screen-reader users
  // get the correct semantic ("button, dimmed, your current tier")
  // rather than a generic div with aria-disabled, which AT often skips.
  if (isCurrentTier) {
    return (
      <button
        type="button"
        disabled
        className="w-full py-2.5 rounded-lg text-[12px] font-bold uppercase tracking-wider text-center bg-white/[0.04] border border-white/[0.06] text-neutral-500 cursor-default"
      >
        <span aria-hidden="true">✓ </span>Your current tier
      </button>
    );
  }

  // Free tier CTA — invite to sign up (if logged out) or just informational
  if (!isPaid) {
    if (isSignedIn) {
      return (
        <button
          type="button"
          disabled
          className="w-full py-2.5 rounded-lg text-[12px] font-bold uppercase tracking-wider text-center bg-white/[0.04] border border-white/[0.06] text-neutral-500 cursor-default"
        >
          Always available
        </button>
      );
    }
    return (
      <Link
        href="/signup"
        className="w-full py-2.5 rounded-lg text-[12px] font-bold uppercase tracking-wider text-center bg-white/[0.06] border border-white/[0.1] text-white hover:bg-white/[0.1] transition-colors inline-flex items-center justify-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50"
      >
        Sign up free <ArrowRight className="w-3 h-3" aria-hidden />
      </Link>
    );
  }

  // Paid tier (Pro / Whale) — subscribe button. Logged-out users go to
  // signup first so they have somewhere to land after checkout.
  if (!isSignedIn) {
    return (
      <Link
        href={`/signup?callbackUrl=${encodeURIComponent('/pricing')}`}
        className={`w-full py-2.5 rounded-lg text-[12px] font-bold uppercase tracking-wider text-center inline-flex items-center justify-center gap-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-hub-black ${
          tier === 'whale'
            ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-black hover:from-amber-400 hover:to-orange-400 focus-visible:ring-amber-400/60'
            : 'bg-emerald-500 text-black hover:bg-emerald-400 focus-visible:ring-emerald-400/60'
        }`}
      >
        Sign up to get {b.label} <ArrowRight className="w-3 h-3" aria-hidden />
      </Link>
    );
  }

  // Signed-in, paid tier, not current — actual subscribe CTA.
  return (
    <button
      type="button"
      onClick={onSubscribe}
      className={`w-full py-2.5 rounded-lg text-[12px] font-bold uppercase tracking-wider transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-hub-black ${
        tier === 'whale'
          ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-black hover:from-amber-400 hover:to-orange-400 focus-visible:ring-amber-400/60'
          : 'bg-emerald-500 text-black hover:bg-emerald-400 focus-visible:ring-emerald-400/60'
      }`}
    >
      Get {b.label}
    </button>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <Check className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </li>
  );
}

function FeatureCell({ value, tier }: { value: boolean | string; tier: Tier }) {
  if (value === true) {
    return <Check className={`w-4 h-4 mx-auto ${TIER_BRANDING[tier].textColor}`} aria-label="Included" />;
  }
  if (value === false) {
    return <XIcon className="w-4 h-4 mx-auto text-neutral-700" aria-label="Not included" />;
  }
  return <span className="text-neutral-200">{value}</span>;
}

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 group">
      <summary className="text-[13px] font-semibold text-white cursor-pointer list-none flex items-center justify-between">
        <span>{q}</span>
        <span className="text-neutral-500 group-open:rotate-45 transition-transform">+</span>
      </summary>
      <p className="text-[12px] text-neutral-400 mt-2 leading-relaxed">{a}</p>
    </details>
  );
}

function CheckoutComingSoonModal({
  tier,
  period,
  onClose,
}: {
  tier: Tier;
  period: Period;
  onClose: () => void;
}) {
  const b = TIER_BRANDING[tier];
  const Icon = tierIcon(b.iconName);
  const dismissRef = useRef<HTMLButtonElement>(null);

  // Esc closes the modal (accessibility + matches user expectation).
  // Also lock body scroll while open so the background doesn't drift
  // when the user scrolls the modal on mobile.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Auto-focus the dismiss button so keyboard users land somewhere
    // sensible inside the dialog rather than back at the page.
    dismissRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkout-modal-title"
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="max-w-md w-full rounded-xl border border-white/[0.1] bg-hub-black p-6 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <Icon className={`w-10 h-10 mx-auto mb-3 ${b.textColor}`} aria-hidden />
        <h3 id="checkout-modal-title" className="text-base font-bold text-white mb-2">
          {b.label} ({period}) — free during launch
        </h3>
        <p className="text-[12px] text-neutral-400 mb-4 leading-relaxed">
          You already have access to all {b.label} features. Crypto checkout via
          NowPayments goes live when we exit early access — we&apos;ll email you
          ahead of time with the exact date.
        </p>
        <div className="flex gap-2 justify-center">
          <button
            ref={dismissRef}
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-[12px] font-semibold rounded-lg bg-white/[0.06] border border-white/[0.1] text-neutral-300 hover:bg-white/[0.1] transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
          >
            Got it
          </button>
          <Link
            href="/faq"
            className="px-4 py-2 text-[12px] font-semibold rounded-lg bg-emerald-500 text-black hover:bg-emerald-400 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
          >
            FAQ
          </Link>
        </div>
      </div>
    </div>
  );
}
