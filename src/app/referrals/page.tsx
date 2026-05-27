import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Link from 'next/link';
import { ExternalLink, Gift, Users, Send, ArrowRight, Trophy, DollarSign, Zap, Wallet, Sparkles } from 'lucide-react';

/* ───────────────────────────────────────────────────────────────────────
 * /referrals — public affiliate program landing.
 *
 * Two products in one page:
 *
 * 1. InfoHub Affiliate Program (top) — anyone can earn 20% recurring
 *    lifetime commission on every paid signup. Payouts in USDT on
 *    Solana/Arbitrum/Base. Referred users get 10% off forever. Sign in
 *    → /settings/referrals for your code + dashboard.
 *
 * 2. Exchange Referrals (below) — the team's personal exchange
 *    referral links. Fee discounts for users + helps fund the project.
 * ─────────────────────────────────────────────────────────────────── */

/* ── Referral Partner ──────────────────────────────────────────────── */

interface Partner {
  name: string;
  display: string;
  image: string;
  twitter: string;
  color: string;        // gradient / accent
  badgeColor: string;
}

const PARTNERS: Record<string, Partner> = {
  ocelot: {
    name: 'ocelot',
    display: '0x.0celot',
    image: '/team/ocelot.jpg',
    twitter: 'https://x.com/ocelotIH',
    color: 'from-hub-yellow to-hub-orange',
    badgeColor: 'bg-hub-yellow/15 text-hub-yellow border-hub-yellow/20',
  },
  snakether: {
    name: 'snakether',
    display: 'snakether',
    image: '/team/mf0x.jpg',
    twitter: 'https://x.com/snakether',
    color: 'from-blue-500 to-purple-500',
    badgeColor: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  },
};

/* ── Exchange Referral Links ───────────────────────────────────────── */

interface ExchangeReferral {
  exchange: string;       // must match /exchanges/{name}.png (lowercase)
  displayName: string;
  links: { partner: string; url: string }[];
}

const EXCHANGE_REFERRALS: ExchangeReferral[] = [
  {
    exchange: 'bybit',
    displayName: 'Bybit',
    links: [
      { partner: 'ocelot', url: 'https://www.bybit.com/invite?ref=VL792O' },
    ],
  },
  {
    exchange: 'bitget',
    displayName: 'Bitget',
    links: [
      { partner: 'ocelot', url: 'https://share.bitget.com/u/SSFL1S2B' },
    ],
  },
  {
    exchange: 'mexc',
    displayName: 'MEXC',
    links: [
      { partner: 'ocelot', url: 'https://promote.mexc.com/r/7zeuU9AdFM' },
      { partner: 'snakether', url: 'https://promote.mexc.com/r/i98MMJzX' },
    ],
  },
  {
    exchange: 'kucoin',
    displayName: 'KuCoin',
    links: [
      { partner: 'ocelot', url: 'https://www.kucoin.com/r/rf/CXEJE3SG' },
      { partner: 'snakether', url: 'https://www.kucoin.com/r/rf/QBS4DW6N' },
    ],
  },
  {
    exchange: 'bitunix',
    displayName: 'Bitunix',
    links: [
      { partner: 'snakether', url: 'https://www.bitunix.com/register?inviteCode=sv6axk' },
    ],
  },
  {
    exchange: 'hyperliquid',
    displayName: 'Hyperliquid',
    links: [
      { partner: 'snakether', url: 'https://app.hyperliquid.xyz/join/SNAKETHER' },
    ],
  },
  {
    exchange: 'gmx',
    displayName: 'GMX',
    links: [
      { partner: 'ocelot', url: 'https://app.gmx.io/#/trade/?ref=Q9ENQ' },
      { partner: 'snakether', url: 'https://app.gmx.io/#/trade/?ref=snakether' },
    ],
  },
  {
    exchange: 'aster',
    displayName: 'Aster DEX',
    links: [
      { partner: 'ocelot', url: 'https://www.asterdex.com/en/referral/48aFb9' },
    ],
  },
  {
    exchange: 'lighter',
    displayName: 'Lighter',
    links: [
      { partner: 'ocelot', url: 'https://app.lighter.xyz/?referral=7162321B' },
    ],
  },
  {
    exchange: 'gtrade',
    displayName: 'gTrade',
    links: [
      { partner: 'snakether', url: 'https://gains.trade/referred?by=arasaka' },
    ],
  },
];

/* ── Page ───────────────────────────────────────────────────────────── */

export default function ReferralsPage() {
  return (
    <div className="min-h-screen bg-hub-black">
      <Header />

      <main id="main-content" className="max-w-[1100px] mx-auto px-4 sm:px-6">
        {/* ─── InfoHub Affiliate Program Hero ─── */}
        <section className="relative py-12 sm:py-16 text-center overflow-hidden">
          <div className="absolute inset-0 hero-mesh opacity-60 pointer-events-none" />
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
            style={{
              background:
                'radial-gradient(circle, rgb(var(--hub-accent-rgb) / 0.06) 0%, transparent 70%)',
            }}
          />

          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-400/25 text-emerald-300 text-xs font-semibold mb-6">
              <Sparkles className="w-3.5 h-3.5" />
              InfoHub Affiliate Program
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white mb-4">
              Earn{' '}
              <span className="text-gradient">20% recurring</span>
              <br className="sm:hidden" />
              {' '}lifetime
            </h1>

            <p className="text-neutral-400 text-sm sm:text-base max-w-xl mx-auto leading-relaxed mb-2">
              Share InfoHub with traders. Every paid signup pays you{' '}
              <strong className="text-emerald-300">20%</strong> of their subscription{' '}
              <strong className="text-white">forever</strong>. Payouts in USDT.
            </p>
            <p className="text-neutral-500 text-xs sm:text-sm max-w-xl mx-auto">
              Your referrals get <strong className="text-white">10% off</strong> forever.
              90-day cookie. $25 min payout. Active during launch, commissions begin
              the day paid checkouts go live.
            </p>

            <div className="mt-7 flex items-center gap-2 justify-center flex-wrap">
              <Link
                href="/settings/referrals"
                className="group inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-lg bg-emerald-500 text-black hover:bg-emerald-400 transition-colors"
              >
                <Send className="w-4 h-4" />
                Get my referral link
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <Link
                href="/leaderboard"
                className="group inline-flex items-center gap-2 text-xs font-semibold px-3.5 py-2.5 rounded-lg bg-amber-500/10 border border-amber-400/25 text-amber-300 hover:bg-amber-500/15 hover:text-amber-200 transition-colors"
              >
                <Trophy className="w-3.5 h-3.5" />
                Leaderboard
              </Link>
              <Link
                href="/signup"
                className="group inline-flex items-center gap-2 text-xs font-semibold px-3.5 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-neutral-300 hover:bg-white/[0.08] hover:text-white transition-colors"
              >
                Sign up first
              </Link>
            </div>

            {/* ─── Program terms grid ─── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-10 max-w-3xl mx-auto text-left">
              <ProgramTerm
                icon={DollarSign}
                title="20% recurring lifetime"
                detail="Every paid month they pay, you earn 20%. Forever — no claw-back, no expiry."
              />
              <ProgramTerm
                icon={Wallet}
                title="USDT payouts"
                detail="Paid in USDT on Solana, Arbitrum, or Base. Low gas, fast settlement. $25 minimum."
              />
              <ProgramTerm
                icon={Zap}
                title="10% off for referrals"
                detail="Anyone signing up via your link gets 10% off forever — sweetens your share."
              />
            </div>
          </div>
        </section>

        <div className="accent-line mb-10" />

        {/* ─── How it works ─── */}
        <section className="mb-14">
          <h2 className="text-base font-bold text-white mb-1 px-1">How it works</h2>
          <p className="text-[12px] text-neutral-500 mb-5 px-1">
            Three steps. The whole program is automatic.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Step
              num={1}
              title="Sign in & grab your link"
              body="Every InfoHub account gets a referral code at /settings/referrals. Share the link anywhere — Twitter, Telegram, your newsletter, content."
            />
            <Step
              num={2}
              title="They click & sign up"
              body="90-day cookie attribution. When someone clicks your link and signs up — even months later — they're tagged to you. Their first month is 10% off forever."
            />
            <Step
              num={3}
              title="They pay, you earn"
              body="When they upgrade past the free tier, you earn 20% of every paid month for the life of their account. USDT to your wallet once your balance hits $25."
            />
          </div>
        </section>

        {/* ─── Program FAQ ─── */}
        <section className="mb-14">
          <h2 className="text-base font-bold text-white mb-3 px-1">Program FAQ</h2>
          <div className="space-y-2">
            <FaqRow
              q="When do commissions actually start?"
              a="The program is active and tracking right now. Commissions accrue from the day NowPayments checkout goes live (in the next few weeks). Until then we're recording every signup against your code so when paid launches, your retroactive commissions are already attributed."
            />
            <FaqRow
              q="Why USDT and not USD / PayPal?"
              a="Lower fees, faster settlement, no banking gates. Pick the chain (Solana, Arbitrum, or Base) and address in /settings/referrals. We push payouts monthly once your balance crosses $25."
            />
            <FaqRow
              q="What counts as a 'paid signup'?"
              a="Their first successful paid month — Trader $12, Pro $29, or Whale $59. Commission is 20% of whatever tier they're on, recurring every renewal."
            />
            <FaqRow
              q="What if they cancel?"
              a="No commission for that month. If they re-subscribe later, attribution holds — they're still your referral. The 90-day cookie governs first attribution; after that it's permanent."
            />
            <FaqRow
              q="Can I self-refer or stack codes?"
              a="No on self-referral — the system blocks attribution to your own account. Codes don't stack (one referrer per user). Going through Ben Infin8's link doesn't get you a second commission from your own account."
            />
            <FaqRow
              q="Creator / influencer with audience?"
              a="DM us on Telegram — we offer custom terms for creators driving meaningful volume (extended cookie, higher rate, co-marketing). Floor is the standard 20%/lifetime."
            />
          </div>
        </section>

        {/* ─── Team (existing partners) ─── */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
          {Object.values(PARTNERS).map((p) => (
            <div
              key={p.name}
              className="relative rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 flex items-center gap-4 group hover:border-white/[0.1] transition-colors"
            >
              <div className={`p-[2px] rounded-full bg-gradient-to-br ${p.color} flex-shrink-0`}>
                <div className="w-12 h-12 rounded-full overflow-hidden bg-hub-darker">
                  <img
                    src={p.image}
                    alt={p.display}
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">{p.display}</span>
                  <a
                    href={p.twitter}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-neutral-600 hover:text-hub-yellow transition-colors"
                    title="Twitter / X"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                  </a>
                </div>
                <p className="text-xs text-neutral-600 mt-0.5">
                  {p.name === 'ocelot' ? 'Founder' : 'Advisor'}
                </p>
              </div>
            </div>
          ))}
        </section>

        {/* ─── Exchange referral section ─── */}
        <section className="mb-6">
          <div className="flex items-end justify-between mb-2 px-1">
            <h2 className="text-base font-bold text-white">Exchange referrals</h2>
            <Link
              href="/invite"
              className="text-[11px] text-neutral-500 hover:text-emerald-300 transition-colors"
            >
              Refer friends to InfoHub →
            </Link>
          </div>
          <p className="text-[12px] text-neutral-500 mb-5 px-1 leading-relaxed">
            Personal referral links from the InfoHub team. Most exchanges offer fee discounts
            when you sign up via a referral — you save, we keep building.
          </p>
        </section>

        {/* ─── Exchange Grid ─── */}
        <section className="mb-16">
          <div className="grid gap-3">
            {EXCHANGE_REFERRALS.map((ex) => (
              <div
                key={ex.exchange}
                className="group relative rounded-xl border border-white/[0.06] bg-white/[0.02] hover:border-white/[0.1] transition-all duration-200"
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-0 p-4 sm:p-5">
                  <div className="flex items-center gap-3 sm:w-48 flex-shrink-0">
                    <div className="w-8 h-8 rounded-lg bg-white/[0.06] border border-white/[0.06] flex items-center justify-center overflow-hidden flex-shrink-0">
                      <img
                        src={`/exchanges/${ex.exchange}.png`}
                        alt={ex.displayName}
                        loading="lazy"
                        className="w-5 h-5 object-contain"
                      />
                    </div>
                    <span className="text-sm font-semibold text-white">{ex.displayName}</span>
                  </div>

                  <div className="flex flex-wrap gap-2 sm:ml-auto">
                    {ex.links.map((link) => {
                      const partner = PARTNERS[link.partner];
                      return (
                        <a
                          key={link.partner}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`
                            inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium
                            border transition-all duration-200
                            ${link.partner === 'ocelot'
                              ? 'bg-hub-yellow/[0.08] border-hub-yellow/20 text-hub-yellow hover:bg-hub-yellow/[0.15] hover:border-hub-yellow/30'
                              : 'bg-blue-500/[0.08] border-blue-500/20 text-blue-400 hover:bg-blue-500/[0.15] hover:border-blue-500/30'
                            }
                          `}
                        >
                          <img
                            src={partner.image}
                            alt={partner.display}
                            loading="lazy"
                            className="w-4 h-4 rounded-full object-cover"
                          />
                          {partner.display}
                          <ExternalLink className="w-3 h-3 opacity-60" />
                        </a>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ─── Info Note ─── */}
        <section className="mb-12">
          <div className="relative rounded-xl overflow-hidden border border-white/[0.06]">
            <div className="absolute inset-0 bg-gradient-to-br from-hub-yellow/[0.03] via-transparent to-blue-500/[0.03]" />
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-hub-yellow/20 to-transparent" />

            <div className="relative p-6 sm:p-8 text-center">
              <Users className="w-5 h-5 text-neutral-600 mx-auto mb-3" />
              <p className="text-neutral-500 text-sm leading-relaxed max-w-lg mx-auto">
                Exchange referrals are personal links from the InfoHub team — they fund the
                project. The InfoHub affiliate program above pays <strong className="text-emerald-300">you</strong>{' '}
                20% for every paid InfoHub signup you bring.
              </p>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

/* ─── Sub-components ────────────────────────────────────────────────── */

function ProgramTerm({
  icon: Icon, title, detail,
}: { icon: typeof DollarSign; title: string; detail: string }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-emerald-300" aria-hidden />
        <h3 className="text-[12px] font-bold text-white tracking-tight">{title}</h3>
      </div>
      <p className="text-[11px] text-neutral-400 leading-relaxed">{detail}</p>
    </div>
  );
}

function Step({ num, title, body }: { num: number; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/15 text-emerald-300 text-[10px] font-bold border border-emerald-400/30">
          {num}
        </span>
        <h3 className="text-[12px] font-bold text-white">{title}</h3>
      </div>
      <p className="text-[11px] text-neutral-400 leading-relaxed">{body}</p>
    </div>
  );
}

function FaqRow({ q, a }: { q: string; a: string }) {
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
