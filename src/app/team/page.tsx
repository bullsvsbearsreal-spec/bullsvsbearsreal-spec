import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Link from 'next/link';
import { ALL_EXCHANGES } from '@/lib/constants';

interface TeamMember {
  name: string;
  role: string;
  image: string;
  bio: string;
  stats: { label: string; value: string }[];
  socials?: { twitter?: string };
  ringColor: string;
  roleBadgeColor: string;
}

const teamMembers: TeamMember[] = [
  {
    name: '0x.0celot',
    role: 'Founder',
    image: '/team/ocelot.jpg',
    bio: 'Honestly just wanted one clean page to compare funding rates. Every tool out there was either ugly, expensive, or both. Built a quick thing for himself, showed it to a few traders, and they wouldn’t stop asking for more features. Still hasn’t stopped adding them.',
    stats: [
      { label: 'Building Since', value: '2024' },
      { label: 'Ships', value: 'Daily' },
    ],
    socials: { twitter: 'https://x.com/ocelotIH' },
    ringColor: 'from-hub-yellow via-hub-orange to-hub-yellow-dark',
    roleBadgeColor: 'bg-hub-yellow/15 text-hub-yellow border-hub-yellow/20',
  },
  {
    name: 'snakether',
    role: 'Advisor',
    image: '/team/mf0x.jpg',
    bio: 'Went from trading rates at a desk to trading perps from his couch. 15 years in and derivatives are still the only thing that gets him out of bed. Lives on Hyperliquid, dYdX, and GMX. The kind of person who DMs you at 4am because one number looked slightly off.',
    stats: [
      { label: 'Annual Volume', value: '$1B+' },
      { label: 'In Markets', value: '15+ yrs' },
    ],
    socials: { twitter: 'https://x.com/snakether' },
    ringColor: 'from-blue-500 via-purple-500 to-blue-400',
    roleBadgeColor: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  },
];

const projectStats = [
  { value: `${ALL_EXCHANGES.length}`, label: 'Exchanges', sub: 'CEX + DEX' },
  { value: '8,000+', label: 'Pairs', sub: 'Updated live' },
  { value: '60s', label: 'Refresh', sub: 'Funding cadence' },
  { value: '24/7', label: 'Uptime', sub: 'No batch jobs' },
];

const principles = [
  {
    title: 'Build it because we use it',
    body: 'Every dashboard exists because we needed it open in another tab. If it isn’t useful for live trading, it doesn’t ship.',
  },
  {
    title: 'No fluff data',
    body: 'No vanity metrics, no padded “sentiment scores”. Just the numbers that move PnL: funding, OI, liquidations, basis, flow.',
  },
  {
    title: 'Free tier that’s actually free',
    body: 'You should never hit a paywall on a public market data point. The free tier is the whole product, the paid tier just removes friction.',
  },
  {
    title: 'Ship fast, fix faster',
    body: 'When something breaks we’d rather hear it from you than pretend it’s fine. Every stale number is a bug, not a feature.',
  },
];

const milestones = [
  { date: '2024 Q3', event: 'First funding rate dashboard, single page, no auth.' },
  { date: '2024 Q4', event: 'Added open interest, liquidations, multi-exchange support.' },
  { date: '2025 Q1', event: 'Smart money + on-chain perps (Hyperliquid, GMX) integrated.' },
  { date: '2025 Q3', event: 'Funding arb scanner, leverage dashboard, public API.' },
  { date: '2026 Q1', event: 'Portfolio sync + alerts across CEX and DEX wallets.' },
  { date: '2026 Q2', event: 'KOL feed, Telegram bot v2, browser push, deeper alerts.' },
];

export default function TeamPage() {
  return (
    <div className="min-h-screen bg-hub-black">
      <Header />

      <main id="main-content" className="max-w-[1400px] mx-auto px-4 sm:px-6">
        {/* ── Hero Section ── */}
        <section className="relative py-16 sm:py-24 text-center overflow-hidden">
          {/* Background glow */}
          <div className="absolute inset-0 hero-mesh opacity-60 pointer-events-none" />
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
            style={{
              background:
                'radial-gradient(circle, rgb(var(--hub-accent-rgb) / 0.06) 0%, transparent 70%)',
            }}
          />

          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-emerald-400 text-[11px] font-medium">Active build</span>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white mb-4">
              Who&apos;s behind{' '}
              <span className="text-gradient">InfoHub</span>
            </h1>

            <p className="text-neutral-500 text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
              Small team, big opinions about how trading data should work.
              We use what we build. That&apos;s the whole quality process.
            </p>
          </div>
        </section>

        {/* ── Accent Divider ── */}
        <div className="accent-line mb-12" />

        {/* ── Team Members ── */}
        <section className="stagger space-y-6 mb-16">
          {teamMembers.map((member) => (
            <div
              key={member.name}
              className="group relative rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-0.5"
            >
              {/* Card background + border glow on hover */}
              <div className="absolute inset-0 rounded-2xl border border-white/[0.06] group-hover:border-white/[0.12] transition-colors duration-300" />
              <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{
                  boxShadow:
                    '0 0 40px rgb(var(--hub-accent-rgb) / 0.06), inset 0 1px 0 rgb(var(--hub-accent-rgb) / 0.1)',
                }}
              />

              {/* Top accent line */}
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-hub-yellow/30 to-transparent opacity-60 group-hover:opacity-100 transition-opacity" />

              <div className="relative bg-white/[0.03] backdrop-blur-sm rounded-2xl p-6 sm:p-8">
                <div className="flex flex-col sm:flex-row gap-6 sm:gap-8 items-center sm:items-start">
                  {/* Profile Image with gradient ring */}
                  <div className="flex-shrink-0">
                    <div className={`relative p-[3px] rounded-full bg-gradient-to-br ${member.ringColor}`}>
                      <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full overflow-hidden bg-hub-darker">
                        <img
                          src={member.image}
                          alt={member.name}
                          loading="lazy"
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex-1 text-center sm:text-left min-w-0">
                    <div className="flex flex-col sm:flex-row items-center sm:items-center gap-2 sm:gap-3 mb-3">
                      <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                        {member.name}
                      </h2>

                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${member.roleBadgeColor}`}
                        >
                          {member.role}
                        </span>

                        {member.socials?.twitter && (
                          <a
                            href={member.socials.twitter}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-white/[0.04] border border-white/[0.06] text-neutral-500 hover:text-hub-yellow hover:border-hub-yellow/30 transition-all duration-200"
                            title="Twitter / X"
                          >
                            <svg
                              className="w-3.5 h-3.5"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                            >
                              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                            </svg>
                          </a>
                        )}
                      </div>
                    </div>

                    <p className="text-neutral-500 text-sm leading-relaxed mb-5 max-w-2xl">
                      {member.bio}
                    </p>

                    {/* Member Stats */}
                    {member.stats.length > 0 && (
                      <div className="flex flex-wrap gap-3 justify-center sm:justify-start">
                        {member.stats.map((stat) => (
                          <div
                            key={stat.label}
                            className="relative bg-white/[0.03] rounded-xl px-4 py-3 text-center border border-white/[0.06] group/stat hover:border-white/[0.1] transition-colors"
                          >
                            <div className="text-base font-bold text-white font-mono tracking-tight">
                              {stat.value}
                            </div>
                            <div className="text-[10px] text-neutral-600 mt-0.5 uppercase tracking-wider font-medium">
                              {stat.label}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </section>

        {/* ── Principles ── */}
        <section className="mb-16">
          <div className="text-center mb-8">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              How we build
            </h2>
            <p className="text-sm text-neutral-500 mt-1.5 max-w-md mx-auto">
              Four rules we keep coming back to.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            {principles.map((p, i) => (
              <div
                key={p.title}
                className="relative bg-white/[0.02] border border-white/[0.06] rounded-xl p-5 hover:border-hub-yellow/15 hover:bg-hub-yellow/[0.015] transition-all duration-200"
              >
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-hub-yellow/[0.06] border border-hub-yellow/15 flex items-center justify-center flex-shrink-0 text-[11px] font-bold text-hub-yellow font-mono">
                    {String(i + 1).padStart(2, '0')}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-white mb-1.5 tracking-tight">
                      {p.title}
                    </h3>
                    <p className="text-xs text-neutral-500 leading-relaxed">
                      {p.body}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Project Stats ── */}
        <section className="mb-16">
          <div className="text-center mb-8">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              InfoHub today
            </h2>
            <p className="text-sm text-neutral-500 mt-1.5">Live numbers, no marketing fluff.</p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {projectStats.map((stat) => (
              <div
                key={stat.label}
                className="stat-card group hover:border-white/[0.1] hover:-translate-y-0.5 transition-all duration-300 text-center"
              >
                <div className="text-2xl sm:text-3xl font-bold text-gradient font-mono tracking-tight mb-1">
                  {stat.value}
                </div>
                <div className="text-sm font-semibold text-white">
                  {stat.label}
                </div>
                <div className="text-[10px] text-neutral-600 mt-0.5 uppercase tracking-wider font-medium">
                  {stat.sub}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Timeline ── */}
        <section className="mb-16">
          <div className="text-center mb-8">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              The road so far
            </h2>
            <p className="text-sm text-neutral-500 mt-1.5">From one funding table to a full data terminal.</p>
          </div>

          <div className="relative max-w-2xl mx-auto">
            {/* vertical line */}
            <div className="absolute left-4 sm:left-[7.5rem] top-2 bottom-2 w-px bg-gradient-to-b from-hub-yellow/40 via-white/[0.08] to-transparent" />
            <ol className="space-y-4">
              {milestones.map((m, i) => (
                <li
                  key={m.date}
                  className="relative flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-6 pl-10 sm:pl-0"
                >
                  {/* dot */}
                  <span
                    className={`absolute left-3 sm:left-[7.25rem] top-1.5 w-2 h-2 rounded-full ring-4 ring-hub-black ${
                      i === milestones.length - 1
                        ? 'bg-hub-yellow shadow-[0_0_12px_rgba(255,165,0,0.55)]'
                        : 'bg-white/30'
                    }`}
                  />
                  <div className="hidden sm:block w-28 text-right text-[11px] font-mono text-neutral-500 uppercase tracking-wider pt-1">
                    {m.date}
                  </div>
                  <div className="flex-1">
                    <div className="sm:hidden text-[10px] font-mono text-neutral-500 uppercase tracking-wider mb-0.5">
                      {m.date}
                    </div>
                    <p className="text-sm text-neutral-300 leading-relaxed">{m.event}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── CTA Section ── */}
        <section className="mb-12">
          <div className="relative rounded-2xl overflow-hidden">
            {/* Gradient background */}
            <div className="absolute inset-0 bg-gradient-to-br from-hub-yellow/[0.04] via-transparent to-hub-orange/[0.04]" />
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-hub-yellow/30 to-transparent" />

            <div className="relative border border-white/[0.06] rounded-2xl p-8 sm:p-12 text-center">
              <h3 className="text-xl sm:text-2xl font-bold text-white mb-3 tracking-tight">
                Missing an exchange or feature?
              </h3>
              <p className="text-neutral-500 text-sm sm:text-base mb-6 max-w-lg mx-auto leading-relaxed">
                DM us on X, drop into Telegram, or send an email. Bug reports,
                exchange requests, feature ideas, all welcome.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
                <a
                  href="https://x.com/info_hub69"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                  Follow @info_hub69
                </a>

                <a
                  href="https://t.me/+Z6SQGJ57SlwyY2Rk"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z" />
                  </svg>
                  Join Telegram
                </a>

                <a
                  href="mailto:contact@info-hub.io"
                  className="btn-secondary inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
                    />
                  </svg>
                  Email us
                </a>

              </div>

              <div className="mt-8 pt-6 border-t border-white/[0.04] flex flex-wrap items-center justify-center gap-4 text-[11px] text-neutral-600">
                <Link href="/donate" className="hover:text-hub-yellow transition-colors">
                  Support InfoHub
                </Link>
                <span className="text-neutral-700">·</span>
                <Link href="/developers" className="hover:text-hub-yellow transition-colors">
                  Build with our API
                </Link>
                <span className="text-neutral-700">·</span>
                <Link href="/social" className="hover:text-hub-yellow transition-colors">
                  Follow the KOL feed
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
