'use client';

import Header from '@/components/Header';

interface TeamMember {
  name: string;
  role: string;
  image: string;
  bio: string;
  stats: { label: string; value: string }[];
  socials?: { twitter?: string };
}

const teamMembers: TeamMember[] = [
  {
    name: '0x.0celot',
    role: 'Founder',
    image: '/team/ocelot.jpg',
    bio: 'Founder of InfoHub, building the future of real-time trading data. Passionate about creating tools that empower traders with accurate, timely information.',
    stats: [],
  },
  {
    name: 'snakether',
    role: 'Advisor',
    image: '/team/mf0x.jpg',
    bio: 'Strategic advisor with deep expertise in market analysis and trading infrastructure development. Over 15 years of trading experience with $1B+ annual volume across major DEXs. Trusted advisor to leading exchanges for market insights and product development.',
    stats: [
      { label: 'Trading Volume', value: '$1B+/year' },
      { label: 'Experience', value: '15+ Years' },
    ],
    socials: { twitter: 'https://x.com/snakether' },
  },
];

export default function TeamPage() {
  return (
    <div className="min-h-screen bg-hub-black">
      <Header />

      <main className="max-w-[1400px] mx-auto px-4 py-6">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-white">Team</h1>
          <p className="text-neutral-600 text-xs mt-0.5">
            Building the future of real-time trading data
          </p>
        </div>

        {/* Team Grid */}
        <div className="space-y-8">
          {teamMembers.map((member, index) => (
            <div
              key={member.name}
              className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-8 hover:border-hub-yellow/30 transition-all duration-300"
            >
              <div className="flex flex-col lg:flex-row gap-8 items-center lg:items-start">
                {/* Profile Image */}
                <div className="flex-shrink-0">
                  <div className="w-36 h-36 rounded-xl overflow-hidden border border-white/[0.06]">
                    <img
                      src={member.image}
                      alt={member.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>

                {/* Info */}
                <div className="flex-1 text-center lg:text-left">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-sm font-bold text-white">{member.name}</h2>
                    {member.socials?.twitter && (
                      <a
                        href={member.socials.twitter}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-neutral-500 hover:text-hub-yellow transition-colors"
                        title="Twitter / X"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
                      </a>
                    )}
                  </div>

                  <p className="text-hub-yellow font-medium text-xs mb-3">{member.role}</p>

                  <p className="text-neutral-600 text-xs leading-relaxed mb-4 max-w-2xl">
                    {member.bio}
                  </p>

                  {/* Stats */}
                  {member.stats.length > 0 && (
                    <div className="flex flex-wrap gap-4 justify-center lg:justify-start">
                      {member.stats.map((stat) => (
                        <div
                          key={stat.label}
                          className="bg-hub-darker rounded-lg px-4 py-2.5 text-center border border-white/[0.06]"
                        >
                          <div className="text-sm font-bold text-white font-mono">{stat.value}</div>
                          <div className="text-[10px] text-neutral-600 mt-0.5">{stat.label}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Join Us Section */}
        <div className="mt-8">
          <div className="bg-hub-darker border border-white/[0.06] rounded-xl p-6 text-center">
            <h3 className="text-sm font-bold text-white mb-2">Want to Join Us?</h3>
            <p className="text-neutral-600 text-xs mb-4 max-w-lg mx-auto">
              We're always looking for talented individuals passionate about trading and data.
            </p>
            <a
              href="mailto:contact@info-hub.io"
              className="inline-flex items-center gap-2 px-4 py-2 bg-hub-yellow text-black font-semibold text-xs rounded-md hover:bg-hub-yellow/90 transition-all"
            >
              Get in Touch
            </a>
          </div>
        </div>

        <div className="mt-6 text-xs text-neutral-600 text-center">
          © 2026 infohub. All rights reserved.
        </div>
      </main>
    </div>
  );
}
