'use client';

import Header from '@/components/Header';
import Footer from '@/components/Footer';

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
    bio: 'Dev, not a trader. Built InfoHub solo because good perp data shouldn\u2019t cost $200/month. Ships daily, usually at weird hours.',
    stats: [],
    socials: { twitter: 'https://x.com/ocelotIH' },
    ringColor: 'from-hub-yellow via-hub-orange to-hub-yellow-dark',
    roleBadgeColor: 'bg-hub-yellow/15 text-hub-yellow border-hub-yellow/20',
  },
  {
    name: 'snakether',
    role: 'Advisor',
    image: '/team/mf0x.jpg',
    bio: 'Runs size across Hyperliquid, dYdX, and Drift. 15 years in derivatives, TradFi to on-chain. Pressure-tests every feature against real trades.',
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
  { value: '24', label: 'Exchanges' },
  { value: '8,000+', label: 'Pairs' },
  { value: 'Live', label: 'Data' },
  { value: '24/7', label: 'Uptime' },
];

export default function TeamPage() {
  return (
    <div className="min-h-screen bg-hub-black">
      <Header />

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6">
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
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white mb-4">
              Who&apos;s behind{' '}
              <span className="text-gradient">InfoHub</span>
            </h1>

            <p className="text-neutral-500 text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
              Two derivatives traders who got tired of paying for data that
              should be free. No VC, no paywall.
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

        {/* ── Project Stats ── */}
        <section className="mb-16">
          <div className="text-center mb-8">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              InfoHub today
            </h2>
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
              </div>
            ))}
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
                DM us on X or send an email. Bug reports, exchange requests,
                feature ideas — all welcome.
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
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
