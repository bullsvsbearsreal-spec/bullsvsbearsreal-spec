import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { ExternalLink, Gift, Users } from 'lucide-react';

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

      <main className="max-w-[1100px] mx-auto px-4 sm:px-6">
        {/* ── Hero ── */}
        <section className="relative py-16 sm:py-24 text-center overflow-hidden">
          <div className="absolute inset-0 hero-mesh opacity-60 pointer-events-none" />
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
            style={{
              background:
                'radial-gradient(circle, rgb(var(--hub-accent-rgb) / 0.06) 0%, transparent 70%)',
            }}
          />

          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-hub-yellow/10 border border-hub-yellow/20 text-hub-yellow text-xs font-semibold mb-6">
              <Gift className="w-3.5 h-3.5" />
              Support the team
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white mb-4">
              Exchange{' '}
              <span className="text-gradient">Referrals</span>
            </h1>

            <p className="text-neutral-500 text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
              Sign up to exchanges through our team&apos;s referral links.
              You get fee discounts, we keep building InfoHub. Win-win.
            </p>
          </div>
        </section>

        <div className="accent-line mb-10" />

        {/* ── Partners ── */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12">
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

        {/* ── Exchange Grid ── */}
        <section className="mb-16">
          <div className="grid gap-3">
            {EXCHANGE_REFERRALS.map((ex) => (
              <div
                key={ex.exchange}
                className="group relative rounded-xl border border-white/[0.06] bg-white/[0.02] hover:border-white/[0.1] transition-all duration-200"
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-0 p-4 sm:p-5">
                  {/* Exchange logo + name */}
                  <div className="flex items-center gap-3 sm:w-48 flex-shrink-0">
                    <div className="w-8 h-8 rounded-lg bg-white/[0.06] border border-white/[0.06] flex items-center justify-center overflow-hidden flex-shrink-0">
                      <img
                        src={`/exchanges/${ex.exchange}.png`}
                        alt={ex.displayName}
                        className="w-5 h-5 object-contain"
                      />
                    </div>
                    <span className="text-sm font-semibold text-white">{ex.displayName}</span>
                  </div>

                  {/* Referral buttons */}
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

        {/* ── Info Note ── */}
        <section className="mb-12">
          <div className="relative rounded-xl overflow-hidden border border-white/[0.06]">
            <div className="absolute inset-0 bg-gradient-to-br from-hub-yellow/[0.03] via-transparent to-blue-500/[0.03]" />
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-hub-yellow/20 to-transparent" />

            <div className="relative p-6 sm:p-8 text-center">
              <Users className="w-5 h-5 text-neutral-600 mx-auto mb-3" />
              <p className="text-neutral-500 text-sm leading-relaxed max-w-lg mx-auto">
                These are personal referral links from the InfoHub team.
                Most exchanges offer fee discounts when you sign up through a referral.
                Check each exchange&apos;s terms for specific benefits.
              </p>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
