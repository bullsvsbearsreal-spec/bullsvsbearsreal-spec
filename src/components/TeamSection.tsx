'use client';

import { Users, ExternalLink, TrendingUp, Award, Clock } from 'lucide-react';

interface TeamMember {
  name: string;
  role: string;
  image: string;
  bio: string;
  stats: {
    label: string;
    value: string;
  }[];
  socials?: {
    twitter?: string;
    discord?: string;
  };
}

const teamMembers: TeamMember[] = [
  {
    name: 'Bulls Bears',
    role: 'Founder',
    image: '/team/bullsbears.jpg',
    bio: 'Founder of InfoHub, building the future of real-time trading data.',
    stats: [],
  },
  {
    name: 'snakether',
    role: 'Advisor',
    image: '/team/mf0x.jpg',
    bio: 'Strategic advisor with deep expertise in market analysis and trading infrastructure development.',
    stats: [
      { label: 'Trading Volume', value: '$1B+/year' },
      { label: 'Experience', value: '15+ Years' },
    ],
    socials: { twitter: 'https://x.com/snakether' },
  },
];

export default function TeamSection() {
  return (
    <div className="bg-hub-gray/20 border border-hub-gray/30 rounded-2xl p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-hub-yellow/10 flex items-center justify-center">
          <Users className="w-5 h-5 text-hub-yellow" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">The Team</h2>
          <p className="text-hub-gray-text text-sm">Building the future of trading data</p>
        </div>
      </div>

      {/* Team Members */}
      <div className="space-y-6">
        {teamMembers.map((member) => (
          <TeamMemberCard key={member.name} member={member} />
        ))}
      </div>
    </div>
  );
}

function TeamMemberCard({ member }: { member: TeamMember }) {
  return (
    <div className="bg-hub-gray/30 border border-hub-gray/30 rounded-xl p-6 hover:border-hub-yellow/30 transition-all">
      <div className="flex flex-col md:flex-row gap-6">
        {/* Profile Image */}
        <div className="flex-shrink-0">
          <div className="relative w-32 h-32 md:w-40 md:h-40 rounded-2xl overflow-hidden bg-gradient-to-br from-purple-600 via-blue-600 to-cyan-500 border-2 border-hub-yellow/30 shadow-lg shadow-purple-500/20">
            {/* Animated background glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-purple-600/50 to-cyan-500/50 animate-pulse" />
            <img
              src={member.image}
              alt={member.name}
              className="relative w-full h-full object-cover z-10"
            />
          </div>
        </div>

        {/* Info */}
        <div className="flex-1">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-2xl font-bold text-white">{member.name}</h3>
                {member.socials?.twitter && (
                  <a
                    href={member.socials.twitter}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-neutral-500 hover:text-hub-yellow transition-colors"
                    title="Twitter / X"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
                  </a>
                )}
              </div>
              <p className="text-hub-yellow font-medium">{member.role}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-hub-yellow/10 border border-hub-yellow/30 text-hub-yellow text-xs font-semibold flex items-center gap-1">
                <Award className="w-3 h-3" />
                Verified
              </span>
            </div>
          </div>

          <p className="text-hub-gray-text mb-4 leading-relaxed">
            {member.bio}
          </p>

          {/* Stats */}
          {member.stats.length > 0 && (
            <div className="grid grid-cols-2 gap-4">
              {member.stats.map((stat) => (
                <div
                  key={stat.label}
                  className="bg-hub-gray/40 rounded-xl p-3 text-center border border-hub-gray/30"
                >
                  <div className="text-lg md:text-xl font-bold text-gradient">{stat.value}</div>
                  <div className="text-xs text-hub-gray-text mt-1">{stat.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
