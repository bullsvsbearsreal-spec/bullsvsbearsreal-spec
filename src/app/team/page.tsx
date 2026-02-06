'use client';

import Header from '@/components/Header';
import MarketTicker from '@/components/MarketTicker';
import { Users, Award, TrendingUp, Clock, Twitter, MessageCircle } from 'lucide-react';

interface TeamMember {
  name: string;
  role: string;
  image: string;
  bio: string;
  stats: { label: string; value: string }[];
}

const teamMembers: TeamMember[] = [
  {
    name: 'Bulls Bears',
    role: 'Founder',
    image: '/team/bullsbears.jpg',
    bio: 'Founder of InfoHub, building the future of real-time trading data. Passionate about creating tools that empower traders with accurate, timely information.',
    stats: [],
  },
  {
    name: 'MF.0X',
    role: 'Advisor',
    image: '/team/mf0x.jpg',
    bio: 'Strategic advisor with deep expertise in market analysis and trading infrastructure development. Over 15 years of trading experience with $1B+ annual volume across major DEXs. Trusted advisor to leading exchanges for market insights and product development.',
    stats: [
      { label: 'Trading Volume', value: '$1B+/year' },
      { label: 'Experience', value: '15+ Years' },
    ],
  },
];

export default function TeamPage() {
  return (
    <div className="min-h-screen bg-hub-black">
      {/* Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-hub-yellow/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-hub-orange/5 rounded-full blur-3xl" />
      </div>

      <Header />
      <MarketTicker />

      <main className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Page Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-hub-yellow/10 border border-hub-yellow/20 mb-6">
            <Users className="w-4 h-4 text-hub-yellow" />
            <span className="text-sm text-hub-yellow font-medium">Our Team</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Meet the <span className="text-gradient">Team</span>
          </h1>
          <p className="text-hub-gray-text text-lg max-w-2xl mx-auto">
            Building the future of real-time trading data, one feature at a time.
          </p>
        </div>

        {/* Team Grid */}
        <div className="space-y-8">
          {teamMembers.map((member, index) => (
            <div
              key={member.name}
              className="bg-hub-gray/20 border border-hub-gray/30 rounded-3xl p-8 hover:border-hub-yellow/30 transition-all duration-300"
            >
              <div className="flex flex-col lg:flex-row gap-8 items-center lg:items-start">
                {/* Profile Image */}
                <div className="flex-shrink-0">
                  <div className="relative w-48 h-48 rounded-2xl overflow-hidden bg-gradient-to-br from-purple-600 via-blue-600 to-cyan-500 border-2 border-hub-yellow/30 shadow-2xl shadow-purple-500/20">
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-600/30 to-cyan-500/30 animate-pulse" />
                    <img
                      src={member.image}
                      alt={member.name}
                      className="relative w-full h-full object-cover z-10"
                    />
                  </div>
                </div>

                {/* Info */}
                <div className="flex-1 text-center lg:text-left">
                  <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-4">
                    <h2 className="text-3xl font-bold text-white">{member.name}</h2>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-hub-yellow/10 border border-hub-yellow/30 text-hub-yellow text-sm font-medium w-fit mx-auto lg:mx-0">
                      <Award className="w-3.5 h-3.5" />
                      Verified
                    </span>
                  </div>

                  <p className="text-hub-yellow font-semibold text-lg mb-4">{member.role}</p>

                  <p className="text-hub-gray-text leading-relaxed mb-6 max-w-2xl">
                    {member.bio}
                  </p>

                  {/* Stats */}
                  {member.stats.length > 0 && (
                    <div className="flex flex-wrap gap-4 justify-center lg:justify-start">
                      {member.stats.map((stat) => (
                        <div
                          key={stat.label}
                          className="bg-hub-gray/30 rounded-xl px-6 py-4 text-center border border-hub-gray/30"
                        >
                          <div className="text-2xl font-bold text-gradient">{stat.value}</div>
                          <div className="text-xs text-hub-gray-text mt-1">{stat.label}</div>
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
        <div className="mt-16 text-center">
          <div className="bg-gradient-to-r from-hub-yellow/10 via-hub-orange/10 to-hub-yellow/10 border border-hub-yellow/20 rounded-3xl p-8">
            <h3 className="text-2xl font-bold text-white mb-3">Want to Join Us?</h3>
            <p className="text-hub-gray-text mb-6 max-w-lg mx-auto">
              We're always looking for talented individuals passionate about trading and data.
            </p>
            <a
              href="mailto:contact@info-hub.io"
              className="inline-flex items-center gap-2 px-6 py-3 bg-hub-yellow text-hub-black font-semibold rounded-xl hover:bg-hub-yellow/90 transition-all"
            >
              Get in Touch
            </a>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-hub-gray/20 mt-16">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <p className="text-center text-hub-gray-text text-sm">
            © 2026 InfoHub. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
