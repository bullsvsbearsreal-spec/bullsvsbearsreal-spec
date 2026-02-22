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
}

const teamMembers: TeamMember[] = [
  {
    name: '0x.0celot',
    role: 'Founder',
    image: '/team/ocelot.jpg',
    bio: 'Got tired of having 30 exchange tabs open just to check funding rates. Built InfoHub to fix that. Writes most of the code, breaks things on weekends, and occasionally sleeps.',
    stats: [],
  },
  {
    name: 'snakether',
    role: 'Advisor',
    image: '/team/mf0x.jpg',
    bio: 'Full-time degen turned advisor. 15+ years in markets, trades $1B+/year across DEXs, and somehow still checks funding rates at 3am. Helps shape what InfoHub builds next.',
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
          <h1 className="heading-page">Team</h1>
          <p className="text-neutral-600 text-xs mt-0.5">
            The people behind the dashboard
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
            <h3 className="text-sm font-bold text-white mb-2">Want to contribute?</h3>
            <p className="text-neutral-600 text-xs mb-4 max-w-lg mx-auto">
              We ship fast and break things. If that sounds fun, reach out.
            </p>
            <a
              href="mailto:contact@info-hub.io"
              className="inline-flex items-center gap-2 px-4 py-2 bg-hub-yellow text-black font-semibold text-xs rounded-md hover:bg-hub-yellow/90 transition-all"
            >
              Get in Touch
            </a>
          </div>
        </div>

      </main>
      <Footer />
    </div>
  );
}
